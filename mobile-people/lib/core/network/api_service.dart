import 'dart:convert';
import 'package:http/http.dart' as http;
import '../storage/local_store.dart';
import '../services/image_cache_manager.dart';
import '../models/person_record.dart';
import '../models/person_connections.dart';
import '../models/person_timeline_item.dart';
import '../models/upcoming_birthday_item.dart';
import '../models/picker_items.dart';
import '../models/trip_record.dart';
import '../models/trip_detail.dart';

class PersonDetailResult {
  final PersonRecord person;
  final PersonConnections connections;
  final List<PersonTimelineItem> timeline;

  const PersonDetailResult({
    required this.person,
    required this.connections,
    required this.timeline,
  });
}

class PeopleFetchResult {
  final List<PersonRecord> items;
  final int total;
  final int page;
  final int totalPages;

  const PeopleFetchResult({
    required this.items,
    required this.total,
    required this.page,
    required this.totalPages,
  });
}

class ApiException implements Exception {
  final int statusCode;
  final String message;

  const ApiException(this.statusCode, this.message);

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiService {
  static const Duration timeoutDuration = Duration(seconds: 30);
  static const Duration uploadTimeoutDuration = Duration(seconds: 120);

  static Future<Map<String, String>> _getHeaders() async {
    final token = await LocalStore.getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  static Future<String> _getBaseUrl() async {
    return await LocalStore.getServerUrl();
  }

  // Authentication
  static Future<bool> login(String serverUrl, String password) async {
    String cleanUrl = serverUrl.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.substring(0, cleanUrl.length - 1);
    }

    final loginUri = Uri.parse('$cleanUrl/api/auth/login');
    final response = await http
        .post(
          loginUri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'password': password}),
        )
        .timeout(timeoutDuration);

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final token = data['token'] as String? ?? 'authenticated';
      await LocalStore.setServerUrl(cleanUrl);
      await LocalStore.setAuthToken(token);
      return true;
    } else {
      String errorMessage = 'Authentication failed (${response.statusCode})';
      try {
        final errorData = jsonDecode(response.body);
        if (errorData['error'] != null) {
          errorMessage = errorData['error'];
        }
      } catch (_) {}
      throw Exception(errorMessage);
    }
  }

  // Fetch People Directory List (Cache-first with 7-day TTL)
  static Future<PeopleFetchResult> getPeople({
    bool forceRefresh = false,
    String search = '',
    String relationshipType = 'all',
    bool? favorite,
    int? birthdayMonth,
    String visibility = 'all',
    String sortBy = 'created_desc',
    int page = 1,
    int limit = 500,
  }) async {
    final bool isDefaultFilter = page == 1 &&
        search.isEmpty &&
        relationshipType == 'all' &&
        (favorite == null || !favorite) &&
        birthdayMonth == null &&
        visibility == 'all';

    // 1. If not forcing refresh and is default directory fetch, check cache first
    if (!forceRefresh && isDefaultFilter) {
      final isStale = await LocalStore.isPeopleCacheStale();
      if (!isStale) {
        final cached = await LocalStore.getCachedPeople();
        if (cached.isNotEmpty) {
          return PeopleFetchResult(
            items: cached,
            total: cached.length,
            page: 1,
            totalPages: 1,
          );
        }
      }
    }

    // 2. Fetch from backend
    try {
      final baseUrl = await _getBaseUrl();
      final queryParams = <String, String>{
        if (search.trim().isNotEmpty) 'search': search.trim(),
        if (relationshipType != 'all') 'relationshipType': relationshipType,
        if (favorite != null && favorite) 'favorite': 'true',
        if (birthdayMonth != null) 'birthdayMonth': birthdayMonth.toString(),
        if (visibility != 'all') 'visibility': visibility,
        'sortBy': sortBy,
        'page': page.toString(),
        'limit': limit.toString(),
      };

      final uri = Uri.parse('$baseUrl/api/people').replace(queryParameters: queryParams);
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final list = (data['people'] as List<dynamic>? ?? [])
            .map((e) => PersonRecord.fromJson(e as Map<String, dynamic>))
            .toList();
        final total = data['total'] as int? ?? list.length;
        final totalPages = data['totalPages'] as int? ?? 1;

        // Cache directory if default initial page
        if (page == 1 && isDefaultFilter) {
          await LocalStore.saveCachedPeople(list);

          // Proactively pre-cache avatars into persistent disk cache in background
          final avatarUrls = list
              .where((p) => p.hasAvatar && p.avatarUrl != null)
              .map((p) => p.avatarUrl!)
              .toList();
          PeopleImageCacheManager.precacheImages(avatarUrls);
        }

        return PeopleFetchResult(
          items: list,
          total: total,
          page: page,
          totalPages: totalPages,
        );
      } else {
        throw Exception('Failed to load people directory (${response.statusCode})');
      }
    } catch (_) {
      // Offline fallback: return cache if available
      final cached = await LocalStore.getCachedPeople();
      if (cached.isNotEmpty) {
        return PeopleFetchResult(
          items: cached,
          total: cached.length,
          page: 1,
          totalPages: 1,
        );
      }
      rethrow;
    }
  }

  // Fetch Single Person Memory Hub (Cache-first with 7-day TTL)
  static Future<PersonDetailResult?> getPersonDetail(
    String idOrSlug, {
    bool forceRefresh = false,
  }) async {
    // 1. Check cache first if not forceRefresh
    if (!forceRefresh) {
      final isStale = await LocalStore.isDetailCacheStale(idOrSlug);
      if (!isStale) {
        final cached = await LocalStore.getCachedPersonDetail(idOrSlug);
        if (cached != null) {
          final person = PersonRecord.fromJson(cached['person'] as Map<String, dynamic>);
          final connections = PersonConnections.fromJson((cached['connections'] as Map<String, dynamic>?) ?? {});
          final rawTimeline = (cached['timeline'] as List<dynamic>?) ?? [];
          final timeline = rawTimeline.map((e) => PersonTimelineItem.fromJson(e as Map<String, dynamic>)).toList();
          return PersonDetailResult(
            person: person,
            connections: connections,
            timeline: timeline,
          );
        }
      }
    }

    // 2. Fetch from network
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/people/$idOrSlug');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final person = PersonRecord.fromJson(data['person'] as Map<String, dynamic>);
        final connections = PersonConnections.fromJson((data['connections'] as Map<String, dynamic>?) ?? {});
        final rawTimeline = (data['timeline'] as List<dynamic>?) ?? [];
        final timeline = rawTimeline.map((e) => PersonTimelineItem.fromJson(e as Map<String, dynamic>)).toList();

        // Cache detail for instant offline reload
        await LocalStore.saveCachedPersonDetail(idOrSlug, data);
        if (person.id != idOrSlug) {
          await LocalStore.saveCachedPersonDetail(person.id, data);
        }
        if (person.slug.isNotEmpty && person.slug != idOrSlug) {
          await LocalStore.saveCachedPersonDetail(person.slug, data);
        }

        // Pre-cache connected photos in background
        final photoUrls = <String>[];
        if (person.hasAvatar) photoUrls.add(person.avatarUrl!);
        for (final photo in connections.photos) {
          if (photo.thumbnailUrl != null) photoUrls.add(photo.thumbnailUrl!);
          if (photo.displayUrl.isNotEmpty) photoUrls.add(photo.displayUrl);
        }
        PeopleImageCacheManager.precacheImages(photoUrls);

        return PersonDetailResult(
          person: person,
          connections: connections,
          timeline: timeline,
        );
      }
      return null;
    } catch (_) {
      // Offline fallback: check cache
      final cached = await LocalStore.getCachedPersonDetail(idOrSlug);
      if (cached != null) {
        final person = PersonRecord.fromJson(cached['person'] as Map<String, dynamic>);
        final connections = PersonConnections.fromJson((cached['connections'] as Map<String, dynamic>?) ?? {});
        final rawTimeline = (cached['timeline'] as List<dynamic>?) ?? [];
        final timeline = rawTimeline.map((e) => PersonTimelineItem.fromJson(e as Map<String, dynamic>)).toList();
        return PersonDetailResult(
          person: person,
          connections: connections,
          timeline: timeline,
        );
      }
      return null;
    }
  }

  // Save Person (Create or Update) with Cache Update
  static Future<PersonRecord> savePerson(Map<String, dynamic> input) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/people');
    final headers = await _getHeaders();

    final response = await http
        .post(
          uri,
          headers: headers,
          body: jsonEncode(input),
        )
        .timeout(timeoutDuration);

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      final record = PersonRecord.fromJson(data['person'] as Map<String, dynamic>);
      await LocalStore.upsertCachedPerson(record);
      if (record.hasAvatar) {
        PeopleImageCacheManager.precacheImage(record.avatarUrl!);
      }
      return record;
    } else {
      String msg = 'Failed to save person (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw ApiException(response.statusCode, msg);
    }
  }

  // Update Person with Cache Update
  static Future<PersonRecord> updatePerson(String id, Map<String, dynamic> input) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/people/$id');
    final headers = await _getHeaders();

    final response = await http
        .put(
          uri,
          headers: headers,
          body: jsonEncode(input),
        )
        .timeout(timeoutDuration);

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final record = PersonRecord.fromJson(data['person'] as Map<String, dynamic>);
      await LocalStore.upsertCachedPerson(record);
      if (record.hasAvatar) {
        PeopleImageCacheManager.precacheImage(record.avatarUrl!);
      }
      return record;
    } else {
      String msg = 'Failed to update person (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw ApiException(response.statusCode, msg);
    }
  }

  // Delete Person with Cache Invalidation
  static Future<bool> deletePerson(String id) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/people/$id');
    final headers = await _getHeaders();

    final response = await http.delete(uri, headers: headers).timeout(timeoutDuration);
    if (response.statusCode == 200) {
      await LocalStore.deleteCachedPerson(id);
      return true;
    } else {
      String msg = 'Failed to delete person (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw ApiException(response.statusCode, msg);
    }
  }

  // Toggle Favorite with Cache Update
  static Future<bool> toggleFavorite(String id) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/people/$id/favorite');
    final headers = await _getHeaders();

    final response = await http.post(uri, headers: headers).timeout(timeoutDuration);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final isFav = data['favorite'] == true;
      await LocalStore.toggleCachedPersonFavorite(id, isFav);
      return isFav;
    } else {
      String msg = 'Failed to toggle favorite (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw ApiException(response.statusCode, msg);
    }
  }

  // Upcoming Birthdays (Cache-first with 7-day TTL)
  static Future<List<UpcomingBirthdayItem>> getUpcomingBirthdays({
    bool forceRefresh = false,
    int limit = 10,
  }) async {
    if (!forceRefresh) {
      final isStale = await LocalStore.isBirthdaysCacheStale();
      if (!isStale) {
        final cached = await LocalStore.getCachedBirthdays();
        if (cached.isNotEmpty) return cached;
      }
    }

    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/people/birthdays?limit=$limit');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final list = (data['upcoming'] as List<dynamic>? ?? [])
            .map((e) => UpcomingBirthdayItem.fromJson(e as Map<String, dynamic>))
            .toList();
        await LocalStore.saveCachedBirthdays(list);
        return list;
      }
      return await LocalStore.getCachedBirthdays();
    } catch (_) {
      return await LocalStore.getCachedBirthdays();
    }
  }

  // Fetch Entity Pickers (Cache-first with 7-day TTL)
  static Future<PeoplePickersResult> getPickers({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final isStale = await LocalStore.isPickersCacheStale();
      if (!isStale) {
        final cached = await LocalStore.getCachedPickers();
        if (cached != null) return cached;
      }
    }

    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/people/pickers');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final result = PeoplePickersResult.fromJson(data);
        await LocalStore.saveCachedPickers(result);
        return result;
      }
      return (await LocalStore.getCachedPickers()) ?? const PeoplePickersResult();
    } catch (_) {
      return (await LocalStore.getCachedPickers()) ?? const PeoplePickersResult();
    }
  }

  // Connect Entity to Person
  static Future<bool> addConnection({
    required String personId,
    required String targetType,
    required String targetId,
    required String relationship,
  }) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/people/$personId/connections');
    final headers = await _getHeaders();

    final response = await http
        .post(
          uri,
          headers: headers,
          body: jsonEncode({
            'targetType': targetType,
            'targetId': targetId,
            'relationship': relationship,
          }),
        )
        .timeout(timeoutDuration);

    if (response.statusCode == 200 || response.statusCode == 201) {
      return true;
    } else {
      String msg = 'Failed to add connection (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw ApiException(response.statusCode, msg);
    }
  }

  // Connect Photos in Batch
  static Future<bool> connectPhotosBatch({
    required String personId,
    required List<Map<String, dynamic>> photos,
    String relationship = 'appears_in',
  }) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/people/$personId/connections');
    final headers = await _getHeaders();

    final response = await http
        .post(
          uri,
          headers: headers,
          body: jsonEncode({
            'photos': photos,
            'relationship': relationship,
          }),
        )
        .timeout(timeoutDuration);

    if (response.statusCode == 200 || response.statusCode == 201) {
      return true;
    } else {
      String msg = 'Failed to connect photos (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw ApiException(response.statusCode, msg);
    }
  }

  // Fetch Cloudinary Photos
  static Future<List<Map<String, dynamic>>> getCloudinaryPhotos() async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/media/cloudinary');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final list = data['resources'] as List<dynamic>? ?? [];
        return list.map((e) => e as Map<String, dynamic>).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  // Remove Entity Connection
  static Future<bool> removeConnection({
    required String personId,
    required String relationshipId,
  }) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/people/$personId/connections?relationshipId=$relationshipId');
    final headers = await _getHeaders();

    final response = await http.delete(uri, headers: headers).timeout(timeoutDuration);
    if (response.statusCode == 200) {
      return true;
    } else {
      String msg = 'Failed to remove connection (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw ApiException(response.statusCode, msg);
    }
  }

  // Upload Avatar to Cloudinary via server
  static Future<String> uploadAvatar(String fileName, List<int> bytes) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/upload');
    final token = await LocalStore.getAuthToken();

    final request = http.MultipartRequest('POST', uri);
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    request.files.add(http.MultipartFile.fromBytes(
      'file',
      bytes,
      filename: fileName,
    ));

    final streamedResponse = await request.send().timeout(uploadTimeoutDuration);
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      final url = data['url'] ?? data['secure_url'] ?? data['imageUrl'];
      if (url == null) {
        throw Exception('Server did not return an image URL');
      }
      return url as String;
    } else {
      throw Exception('Avatar upload failed (${response.statusCode})');
    }
  }

  // --- Trips ---

  // Fetch Trips overview (cache-first with 7-day TTL)
  static Future<List<TripRecord>> getTrips({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final isStale = await LocalStore.isTripsCacheStale();
      if (!isStale) {
        final cached = await LocalStore.getCachedTrips();
        if (cached.isNotEmpty) return cached;
      }
    }

    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/trips?view=overview');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final list = (data['trips'] as List<dynamic>? ?? [])
            .map((e) => TripRecord.fromJson(e as Map<String, dynamic>))
            .toList();
        await LocalStore.saveCachedTrips(list);

        final covers = list
            .where((t) => t.hasCover)
            .map((t) => t.coverImageUrl!)
            .toList();
        PeopleImageCacheManager.precacheImages(covers);

        return list;
      }
      throw ApiException(response.statusCode, 'Failed to load trips (${response.statusCode})');
    } catch (_) {
      final cached = await LocalStore.getCachedTrips();
      if (cached.isNotEmpty) return cached;
      rethrow;
    }
  }

  // Fetch single Trip hub detail (cache-first with 7-day TTL)
  static Future<TripDetailResult?> getTripDetail(
    String idOrSlug, {
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh) {
      final isStale = await LocalStore.isTripDetailCacheStale(idOrSlug);
      if (!isStale) {
        final cached = await LocalStore.getCachedTripDetail(idOrSlug);
        if (cached != null) return TripDetailResult.fromJson(cached);
      }
    }

    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/trips/$idOrSlug');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final result = TripDetailResult.fromJson(data);

        await LocalStore.saveCachedTripDetail(idOrSlug, data);
        if (result.trip.id != idOrSlug) {
          await LocalStore.saveCachedTripDetail(result.trip.id, data);
        }
        if (result.trip.slug.isNotEmpty && result.trip.slug != idOrSlug) {
          await LocalStore.saveCachedTripDetail(result.trip.slug, data);
        }

        final photoUrls = <String>[
          if (result.trip.hasCover) result.trip.coverImageUrl!,
          ...result.photos.map((p) => p.thumbUrl).where((u) => u.isNotEmpty),
        ];
        PeopleImageCacheManager.precacheImages(photoUrls);

        return result;
      }
      return null;
    } catch (_) {
      final cached = await LocalStore.getCachedTripDetail(idOrSlug);
      if (cached != null) return TripDetailResult.fromJson(cached);
      return null;
    }
  }

  // Create Trip (POST) with cache update
  static Future<TripRecord> saveTrip(Map<String, dynamic> input) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/trips');
    final headers = await _getHeaders();

    final response = await http
        .post(uri, headers: headers, body: jsonEncode(input))
        .timeout(timeoutDuration);

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      final record = TripRecord.fromJson(data['trip'] as Map<String, dynamic>);
      await LocalStore.upsertCachedTrip(record);
      return record;
    } else {
      String msg = 'Failed to save trip (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw ApiException(response.statusCode, msg);
    }
  }

  // Update Trip (PUT) with cache update
  static Future<TripRecord> updateTrip(String id, Map<String, dynamic> input) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/trips/$id');
    final headers = await _getHeaders();

    final response = await http
        .put(uri, headers: headers, body: jsonEncode(input))
        .timeout(timeoutDuration);

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final record = TripRecord.fromJson(data['trip'] as Map<String, dynamic>);
      await LocalStore.upsertCachedTrip(record);
      return record;
    } else {
      String msg = 'Failed to update trip (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw ApiException(response.statusCode, msg);
    }
  }

  // Delete Trip with cache invalidation
  static Future<bool> deleteTrip(String id) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/trips/$id');
    final headers = await _getHeaders();

    final response = await http.delete(uri, headers: headers).timeout(timeoutDuration);
    if (response.statusCode == 200) {
      await LocalStore.deleteCachedTrip(id);
      return true;
    } else {
      String msg = 'Failed to delete trip (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw ApiException(response.statusCode, msg);
    }
  }

  // Toggle Trip favorite with cache update
  static Future<bool> toggleTripFavorite(String id, bool favorite) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/trips/$id/favorite');
    final headers = await _getHeaders();

    final response = await http
        .post(uri, headers: headers, body: jsonEncode({'favorite': favorite}))
        .timeout(timeoutDuration);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final isFav = data['favorite'] == true;
      await LocalStore.toggleCachedTripFavorite(id, isFav);
      return isFav;
    } else {
      String msg = 'Failed to toggle trip favorite (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw ApiException(response.statusCode, msg);
    }
  }

  // Duplicate Trip
  static Future<TripRecord?> duplicateTrip(String id) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/trips/$id/duplicate');
    final headers = await _getHeaders();

    final response = await http.post(uri, headers: headers).timeout(timeoutDuration);
    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      final record = TripRecord.fromJson(data['trip'] as Map<String, dynamic>);
      await LocalStore.upsertCachedTrip(record);
      return record;
    } else {
      String msg = 'Failed to duplicate trip (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw ApiException(response.statusCode, msg);
    }
  }

  // --- Trip itinerary days ---

  static Future<void> generateTripDays(String tripId) async {
    await _tripPost('/api/trips/$tripId/days', {'generate': true});
  }

  static Future<void> addTripDay(String tripId, {String? date}) async {
    await _tripPost('/api/trips/$tripId/days', {'date': ?date});
  }

  static Future<void> updateTripDay(String tripId, String dayId, Map<String, dynamic> payload) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/trips/$tripId/days/$dayId');
    final headers = await _getHeaders();
    final response = await http
        .put(uri, headers: headers, body: jsonEncode(payload))
        .timeout(timeoutDuration);
    if (response.statusCode != 200) {
      throw ApiException(response.statusCode, _errorFrom(response.body, 'update day'));
    }
  }

  static Future<void> deleteTripDay(String tripId, String dayId) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/trips/$tripId/days/$dayId');
    final headers = await _getHeaders();
    final response = await http.delete(uri, headers: headers).timeout(timeoutDuration);
    if (response.statusCode != 200) {
      throw ApiException(response.statusCode, _errorFrom(response.body, 'delete day'));
    }
  }

  // --- Trip photos ---

  static Future<bool> connectTripPhotos(
    String tripId,
    List<Map<String, dynamic>> photos, {
    String relationship = 'taken_at',
  }) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/trips/$tripId/photos');
    final headers = await _getHeaders();
    final response = await http
        .post(uri, headers: headers, body: jsonEncode({'photos': photos, 'relationship': relationship}))
        .timeout(uploadTimeoutDuration);
    if (response.statusCode == 200 || response.statusCode == 201) return true;
    throw ApiException(response.statusCode, _errorFrom(response.body, 'connect photos'));
  }

  static Future<bool> removeTripPhoto(String tripId, String connectionId) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/trips/$tripId/photos?connectionId=$connectionId');
    final headers = await _getHeaders();
    final response = await http.delete(uri, headers: headers).timeout(timeoutDuration);
    if (response.statusCode == 200) return true;
    throw ApiException(response.statusCode, _errorFrom(response.body, 'remove photo'));
  }

  // --- Trip connections (locations / people) ---

  static Future<bool> connectTripEntity(String tripId, String targetType, String targetId) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/trips/$tripId/connections');
    final headers = await _getHeaders();
    final response = await http
        .post(uri, headers: headers, body: jsonEncode({'targetType': targetType, 'targetId': targetId}))
        .timeout(timeoutDuration);
    if (response.statusCode == 200 || response.statusCode == 201) return true;
    throw ApiException(response.statusCode, _errorFrom(response.body, 'connect entity'));
  }

  static Future<bool> removeTripConnection(String tripId, String relationshipId) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/trips/$tripId/connections?relationshipId=$relationshipId');
    final headers = await _getHeaders();
    final response = await http.delete(uri, headers: headers).timeout(timeoutDuration);
    if (response.statusCode == 200) return true;
    throw ApiException(response.statusCode, _errorFrom(response.body, 'remove connection'));
  }

  static Future<void> _tripPost(String path, Map<String, dynamic> body) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl$path');
    final headers = await _getHeaders();
    final response = await http
        .post(uri, headers: headers, body: jsonEncode(body))
        .timeout(timeoutDuration);
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw ApiException(response.statusCode, _errorFrom(response.body, 'request'));
    }
  }

  static String _errorFrom(String body, String action) {
    try {
      final err = jsonDecode(body);
      if (err['error'] != null) return err['error'] as String;
    } catch (_) {}
    return 'Failed to $action';
  }

  // Trigger site rebuild / deploy hook
  static Future<bool> triggerDeploy() async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/deploy');
      final headers = await _getHeaders();

      final response = await http.post(uri, headers: headers).timeout(timeoutDuration);
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
