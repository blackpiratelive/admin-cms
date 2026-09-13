import 'dart:convert';
import 'package:http/http.dart' as http;
import '../storage/local_store.dart';
import '../models/person_record.dart';
import '../models/person_connections.dart';
import '../models/person_timeline_item.dart';
import '../models/upcoming_birthday_item.dart';
import '../models/picker_items.dart';

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

  // Fetch People Directory List
  static Future<PeopleFetchResult> getPeople({
    String search = '',
    String relationshipType = 'all',
    bool? favorite,
    int? birthdayMonth,
    String visibility = 'all',
    String sortBy = 'created_desc',
    int page = 1,
    int limit = 50,
  }) async {
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
      if (page == 1 && search.isEmpty && relationshipType == 'all' && (favorite == null || !favorite)) {
        await LocalStore.saveCachedPeople(list);
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
  }

  // Fetch Single Person Memory Hub
  static Future<PersonDetailResult?> getPersonDetail(String idOrSlug) async {
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

  // Save Person (Create or Update)
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
      return PersonRecord.fromJson(data['person'] as Map<String, dynamic>);
    } else {
      String msg = 'Failed to save person (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw Exception(msg);
    }
  }

  // Update Person
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
      return PersonRecord.fromJson(data['person'] as Map<String, dynamic>);
    } else {
      String msg = 'Failed to update person (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw Exception(msg);
    }
  }

  // Delete Person
  static Future<bool> deletePerson(String id) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/people/$id');
    final headers = await _getHeaders();

    final response = await http.delete(uri, headers: headers).timeout(timeoutDuration);
    return response.statusCode == 200;
  }

  // Toggle Favorite
  static Future<bool> toggleFavorite(String id) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/people/$id/favorite');
    final headers = await _getHeaders();

    final response = await http.post(uri, headers: headers).timeout(timeoutDuration);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['favorite'] == true;
    }
    return false;
  }

  // Upcoming Birthdays
  static Future<List<UpcomingBirthdayItem>> getUpcomingBirthdays({int limit = 10}) async {
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

  // Fetch Entity Pickers for Connect Modal
  static Future<PeoplePickersResult> getPickers() async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/people/pickers');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return PeoplePickersResult.fromJson(data);
      }
      return const PeoplePickersResult();
    } catch (_) {
      return const PeoplePickersResult();
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

    return response.statusCode == 200 || response.statusCode == 201;
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
    return response.statusCode == 200;
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
