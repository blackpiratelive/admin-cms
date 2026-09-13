import 'dart:convert';
import 'dart:io';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/person_record.dart';
import '../models/upcoming_birthday_item.dart';
import '../models/picker_items.dart';
import '../models/offline_mutation.dart';

class LocalStore {
  static const _storage = FlutterSecureStorage();

  static const String _keyServerUrl = 'server_url';
  static const String _keyAuthToken = 'auth_token';
  static const String _keyPeopleCache = 'cached_people_list';
  static const String _keyPeopleCacheTime = 'cached_people_timestamp';
  static const String _keyBirthdaysCache = 'cached_upcoming_birthdays';
  static const String _keyBirthdaysCacheTime = 'cached_birthdays_timestamp';
  static const String _keyPickersCache = 'cached_people_pickers';
  static const String _keyPickersCacheTime = 'cached_pickers_timestamp';
  static const String _keyDetailPrefix = 'cached_person_detail_';
  static const String _keyDetailTimePrefix = 'cached_person_detail_time_';
  static const String _keyLastSyncTime = 'last_sync_timestamp';
  static const String _keyOfflineQueue = 'offline_mutations_queue';

  /// Default cache time-to-live: 7 days as requested by user
  static const Duration defaultCacheTtl = Duration(days: 7);

  static String get defaultServerUrl {
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  // Credentials & Server URL
  static Future<String> getServerUrl() async {
    try {
      final url = await _storage.read(key: _keyServerUrl);
      if (url != null && url.isNotEmpty) return url;
    } catch (_) {}

    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_keyServerUrl) ?? defaultServerUrl;
    } catch (_) {
      return defaultServerUrl;
    }
  }

  static Future<void> setServerUrl(String url) async {
    final cleanUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    try {
      await _storage.write(key: _keyServerUrl, value: cleanUrl);
    } catch (_) {}

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyServerUrl, cleanUrl);
    } catch (_) {}
  }

  static Future<String?> getAuthToken() async {
    try {
      final token = await _storage.read(key: _keyAuthToken);
      if (token != null && token.isNotEmpty) return token;
    } catch (_) {}

    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_keyAuthToken);
    } catch (_) {
      return null;
    }
  }

  static Future<void> setAuthToken(String token) async {
    try {
      await _storage.write(key: _keyAuthToken, value: token);
    } catch (_) {}

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyAuthToken, token);
    } catch (_) {}
  }

  static Future<bool> isLoggedIn() async {
    final token = await getAuthToken();
    return token != null && token.isNotEmpty;
  }

  static Future<void> clearAuth() async {
    try {
      await _storage.delete(key: _keyAuthToken);
    } catch (_) {}

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_keyAuthToken);
    } catch (_) {}
  }

  // --- TTL & Staleness Checks ---

  static Future<bool> isPeopleCacheStale({Duration ttl = defaultCacheTtl}) async {
    final prefs = await SharedPreferences.getInstance();
    final ts = prefs.getInt(_keyPeopleCacheTime);
    if (ts == null) return true;
    final last = DateTime.fromMillisecondsSinceEpoch(ts);
    return DateTime.now().difference(last) > ttl;
  }

  static Future<bool> isBirthdaysCacheStale({Duration ttl = defaultCacheTtl}) async {
    final prefs = await SharedPreferences.getInstance();
    final ts = prefs.getInt(_keyBirthdaysCacheTime);
    if (ts == null) return true;
    final last = DateTime.fromMillisecondsSinceEpoch(ts);
    return DateTime.now().difference(last) > ttl;
  }

  static Future<bool> isDetailCacheStale(String idOrSlug, {Duration ttl = defaultCacheTtl}) async {
    final prefs = await SharedPreferences.getInstance();
    final ts = prefs.getInt('$_keyDetailTimePrefix$idOrSlug');
    if (ts == null) return true;
    final last = DateTime.fromMillisecondsSinceEpoch(ts);
    return DateTime.now().difference(last) > ttl;
  }

  static Future<bool> isPickersCacheStale({Duration ttl = defaultCacheTtl}) async {
    final prefs = await SharedPreferences.getInstance();
    final ts = prefs.getInt(_keyPickersCacheTime);
    if (ts == null) return true;
    final last = DateTime.fromMillisecondsSinceEpoch(ts);
    return DateTime.now().difference(last) > ttl;
  }

  // --- Last Sync Timestamp ---

  static Future<DateTime?> getLastSyncTime() async {
    final prefs = await SharedPreferences.getInstance();
    final ts = prefs.getInt(_keyLastSyncTime);
    if (ts == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(ts);
  }

  static Future<void> setLastSyncTime([DateTime? time]) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_keyLastSyncTime, (time ?? DateTime.now()).millisecondsSinceEpoch);
  }

  // --- Cache: People List ---

  static Future<void> saveCachedPeople(List<PersonRecord> people, {bool updateTimestamp = true}) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = people.map((p) => p.toJson()).toList();
    await prefs.setString(_keyPeopleCache, jsonEncode(jsonList));
    if (updateTimestamp) {
      final now = DateTime.now().millisecondsSinceEpoch;
      await prefs.setInt(_keyPeopleCacheTime, now);
      await prefs.setInt(_keyLastSyncTime, now);
    }
  }

  static Future<List<PersonRecord>> getCachedPeople() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_keyPeopleCache);
    if (data == null || data.isEmpty) return [];
    try {
      final List<dynamic> list = jsonDecode(data);
      return list.map((e) => PersonRecord.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  // --- Optimistic Local Mutations ---

  static Future<void> upsertCachedPerson(PersonRecord person) async {
    final current = await getCachedPeople();
    final idx = current.indexWhere((p) => p.id == person.id || (p.slug.isNotEmpty && p.slug == person.slug));
    if (idx != -1) {
      current[idx] = person;
    } else {
      current.insert(0, person);
    }
    await saveCachedPeople(current, updateTimestamp: false);

    // Also update cached single person detail if available
    final cachedDetail = await getCachedPersonDetail(person.id);
    if (cachedDetail != null) {
      cachedDetail['person'] = person.toJson();
      await saveCachedPersonDetail(person.id, cachedDetail, updateTimestamp: false);
      if (person.slug.isNotEmpty) {
        await saveCachedPersonDetail(person.slug, cachedDetail, updateTimestamp: false);
      }
    }
  }

  static Future<void> deleteCachedPerson(String id) async {
    final current = await getCachedPeople();
    current.removeWhere((p) => p.id == id);
    await saveCachedPeople(current, updateTimestamp: false);

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('$_keyDetailPrefix$id');
    await prefs.remove('$_keyDetailTimePrefix$id');
  }

  static Future<void> toggleCachedPersonFavorite(String id, bool favorite) async {
    final current = await getCachedPeople();
    final idx = current.indexWhere((p) => p.id == id);
    if (idx != -1) {
      current[idx] = current[idx].copyWith(favorite: favorite);
      await saveCachedPeople(current, updateTimestamp: false);
    }

    final cachedDetail = await getCachedPersonDetail(id);
    if (cachedDetail != null && cachedDetail['person'] != null) {
      final personJson = Map<String, dynamic>.from(cachedDetail['person'] as Map);
      personJson['favorite'] = favorite;
      cachedDetail['person'] = personJson;
      await saveCachedPersonDetail(id, cachedDetail, updateTimestamp: false);
    }
  }

  // --- Cache: Single Person Detail ---

  static Future<void> saveCachedPersonDetail(
    String idOrSlug,
    Map<String, dynamic> detail, {
    bool updateTimestamp = true,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('$_keyDetailPrefix$idOrSlug', jsonEncode(detail));
    if (updateTimestamp) {
      await prefs.setInt('$_keyDetailTimePrefix$idOrSlug', DateTime.now().millisecondsSinceEpoch);
    }
  }

  static Future<Map<String, dynamic>?> getCachedPersonDetail(String idOrSlug) async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString('$_keyDetailPrefix$idOrSlug');
    if (data == null || data.isEmpty) return null;
    try {
      return jsonDecode(data) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  // --- Cache: Upcoming Birthdays ---

  static Future<void> saveCachedBirthdays(
    List<UpcomingBirthdayItem> birthdays, {
    bool updateTimestamp = true,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = birthdays.map((b) => b.toJson()).toList();
    await prefs.setString(_keyBirthdaysCache, jsonEncode(jsonList));
    if (updateTimestamp) {
      await prefs.setInt(_keyBirthdaysCacheTime, DateTime.now().millisecondsSinceEpoch);
    }
  }

  static Future<List<UpcomingBirthdayItem>> getCachedBirthdays() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_keyBirthdaysCache);
    if (data == null || data.isEmpty) return [];
    try {
      final List<dynamic> list = jsonDecode(data);
      return list.map((e) => UpcomingBirthdayItem.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  // --- Cache: Pickers ---

  static Future<void> saveCachedPickers(PeoplePickersResult pickers, {bool updateTimestamp = true}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyPickersCache, jsonEncode(pickers.toJson()));
    if (updateTimestamp) {
      await prefs.setInt(_keyPickersCacheTime, DateTime.now().millisecondsSinceEpoch);
    }
  }

  static Future<PeoplePickersResult?> getCachedPickers() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_keyPickersCache);
    if (data == null || data.isEmpty) return null;
    try {
      final json = jsonDecode(data) as Map<String, dynamic>;
      return PeoplePickersResult.fromCachedJson(json);
    } catch (_) {
      return null;
    }
  }

  // --- Offline Mutations Queue ---

  static Future<List<OfflineMutation>> getOfflineQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_keyOfflineQueue);
    if (data == null || data.isEmpty) return [];
    try {
      final List<dynamic> list = jsonDecode(data);
      return list.map((e) => OfflineMutation.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> enqueueMutation(OfflineMutation mutation) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = await getOfflineQueue();
    queue.add(mutation);
    final jsonList = queue.map((m) => m.toJson()).toList();
    await prefs.setString(_keyOfflineQueue, jsonEncode(jsonList));
  }

  static Future<void> removeMutation(String mutationId) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = await getOfflineQueue();
    queue.removeWhere((m) => m.id == mutationId);
    final jsonList = queue.map((m) => m.toJson()).toList();
    await prefs.setString(_keyOfflineQueue, jsonEncode(jsonList));
  }

  static Future<void> clearOfflineQueue() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyOfflineQueue);
  }

  static Future<void> clearAllCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyPeopleCache);
    await prefs.remove(_keyPeopleCacheTime);
    await prefs.remove(_keyBirthdaysCache);
    await prefs.remove(_keyBirthdaysCacheTime);
    await prefs.remove(_keyPickersCache);
    await prefs.remove(_keyPickersCacheTime);
    await prefs.remove(_keyLastSyncTime);

    // Remove any cached person details
    final keys = prefs.getKeys();
    for (final k in keys) {
      if (k.startsWith(_keyDetailPrefix) || k.startsWith(_keyDetailTimePrefix)) {
        await prefs.remove(k);
      }
    }
  }
}
