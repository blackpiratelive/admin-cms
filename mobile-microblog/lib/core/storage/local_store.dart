import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/microblog_post.dart';

class LocalStore {
  static const _storage = FlutterSecureStorage();

  static const String _keyServerUrl = 'pref_server_url';
  static const String _keyAuthToken = 'secure_auth_token';
  static const String _keyCachedPosts = 'pref_cached_microblogs';

  static String get defaultServerUrl {
    try {
      if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    } catch (_) {}
    return 'http://localhost:3000';
  }

  // Server URL
  static Future<String> getServerUrl() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_keyServerUrl) ?? defaultServerUrl;
    } catch (_) {
      return defaultServerUrl;
    }
  }

  static Future<void> setServerUrl(String url) async {
    final cleanUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyServerUrl, cleanUrl);
  }

  // Auth Token
  static Future<String?> getAuthToken() async {
    try {
      final token = await _storage.read(key: _keyAuthToken);
      if (token != null && token.isNotEmpty) return token;
    } catch (_) {}

    // SharedPreferences fallback
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyAuthToken);
  }

  static Future<void> setAuthToken(String token) async {
    try {
      await _storage.write(key: _keyAuthToken, value: token);
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyAuthToken, token);
  }

  static Future<bool> isLoggedIn() async {
    final token = await getAuthToken();
    return token != null && token.isNotEmpty;
  }

  static Future<void> logout() async {
    try {
      await _storage.delete(key: _keyAuthToken);
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyAuthToken);
  }

  // Cached Microblog Posts
  static Future<List<MicroblogPost>> getCachedPosts() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = prefs.getString(_keyCachedPosts);
      if (jsonStr == null || jsonStr.isEmpty) return [];

      final decoded = jsonDecode(jsonStr);
      if (decoded is List) {
        return decoded
            .map((item) => MicroblogPost.fromJson(item as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {}
    return [];
  }

  static Future<void> saveCachedPosts(List<MicroblogPost> posts) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = jsonEncode(posts.map((p) => p.toJson()).toList());
      await prefs.setString(_keyCachedPosts, jsonStr);
    } catch (_) {}
  }
}
