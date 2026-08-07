import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppStorage {
  static const _storage = FlutterSecureStorage();
  
  static const _keyServerUrl = 'cms_server_url';
  static const _keyAuthToken = 'cms_auth_token';
  static const _keyActiveTheme = 'cms_active_theme';
  static const _keyAutosaveEnabled = 'cms_autosave_enabled';

  // Server URL
  static Future<String?> getServerUrl() async {
    return await _storage.read(key: _keyServerUrl);
  }

  static Future<void> setServerUrl(String url) async {
    String cleanUrl = url.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.substring(0, cleanUrl.length - 1);
    }
    await _storage.write(key: _keyServerUrl, value: cleanUrl);
  }

  // Auth Token
  static Future<String?> getAuthToken() async {
    return await _storage.read(key: _keyAuthToken);
  }

  static Future<void> setAuthToken(String token) async {
    await _storage.write(key: _keyAuthToken, value: token);
  }

  static Future<void> clearAuth() async {
    await _storage.delete(key: _keyAuthToken);
  }

  static Future<void> logout() async {
    await _storage.delete(key: _keyAuthToken);
  }

  // Active Theme ('hn', 'dark', 'mono', 'teal')
  static Future<String> getActiveTheme() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyActiveTheme) ?? 'hn';
  }

  static Future<void> setActiveTheme(String themeKey) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyActiveTheme, themeKey);
  }

  // Autosave Preference
  static Future<bool> isAutosaveEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyAutosaveEnabled) ?? true;
  }

  static Future<void> setAutosaveEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyAutosaveEnabled, enabled);
  }
}
