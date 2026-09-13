import 'dart:convert';
import 'dart:io';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/person_record.dart';
import '../models/upcoming_birthday_item.dart';
import '../models/offline_mutation.dart';

class LocalStore {
  static const _storage = FlutterSecureStorage();

  static const String _keyServerUrl = 'server_url';
  static const String _keyAuthToken = 'auth_token';
  static const String _keyPeopleCache = 'cached_people_list';
  static const String _keyBirthdaysCache = 'cached_upcoming_birthdays';
  static const String _keyOfflineQueue = 'offline_mutations_queue';

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


  // Cache: People List
  static Future<void> saveCachedPeople(List<PersonRecord> people) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = people.map((p) => p.toJson()).toList();
    await prefs.setString(_keyPeopleCache, jsonEncode(jsonList));
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

  // Cache: Single Person Detail
  static Future<void> saveCachedPersonDetail(String idOrSlug, Map<String, dynamic> detail) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('cached_person_detail_$idOrSlug', jsonEncode(detail));
  }

  static Future<Map<String, dynamic>?> getCachedPersonDetail(String idOrSlug) async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString('cached_person_detail_$idOrSlug');
    if (data == null || data.isEmpty) return null;
    try {
      return jsonDecode(data) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  // Cache: Upcoming Birthdays
  static Future<void> saveCachedBirthdays(List<UpcomingBirthdayItem> birthdays) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = birthdays.map((b) => b.toJson()).toList();
    await prefs.setString(_keyBirthdaysCache, jsonEncode(jsonList));
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

  // Offline Mutations Queue
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
    await prefs.remove(_keyBirthdaysCache);
  }
}
