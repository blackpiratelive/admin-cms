import 'dart:convert';
import 'package:http/http.dart' as http;
import '../storage/app_storage.dart';
import '../models/microblog.dart';
import '../models/location.dart';
import '../models/trip.dart';
import '../models/social_status.dart';
import '../models/journal_entry.dart';
import '../models/journal_key.dart';
import '../models/journal_settings.dart';
import '../models/journal_asset.dart';

class ApiClient {
  static const Duration timeoutDuration = Duration(seconds: 5);

  static Future<Map<String, String>> _getHeaders() async {
    final token = await AppStorage.getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  static Future<String> _getBaseUrl() async {
    final url = await AppStorage.getServerUrl();
    if (url == null || url.isEmpty) {
      throw Exception('Server URL is not configured');
    }
    return url;
  }

  // Authenticate user with custom URL and password
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
      await AppStorage.setServerUrl(cleanUrl);
      await AppStorage.setAuthToken(token);
      return true;
    } else {
      final errorData = jsonDecode(response.body);
      throw Exception(errorData['error'] ?? 'Authentication failed (${response.statusCode})');
    }
  }

  // Fetch Microblogs list
  static Future<MicroblogFetchResult> getMicroblogs({
    String search = '',
    String status = 'all',
    int page = 1,
    int limit = 50,
  }) async {
    final baseUrl = await _getBaseUrl();
    final queryParams = {
      if (search.trim().isNotEmpty) 'search': search.trim(),
      if (status != 'all') 'status': status,
      'page': page.toString(),
      'limit': limit.toString(),
    };

    final uri = Uri.parse('$baseUrl/api/microblogs').replace(queryParameters: queryParams);
    final headers = await _getHeaders();

    final response = await http.get(uri, headers: headers).timeout(timeoutDuration);

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return MicroblogFetchResult.fromJson(data);
    } else {
      throw Exception('Failed to load microblogs (${response.statusCode})');
    }
  }

  // Save/Update Microblog
  static Future<Map<String, dynamic>> saveMicroblog(Map<String, dynamic> input) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/microblogs');
    final headers = await _getHeaders();

    final response = await http
        .post(
          uri,
          headers: headers,
          body: jsonEncode(input),
        )
        .timeout(timeoutDuration);

    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(response.body);
    } else {
      final errorBody = jsonDecode(response.body);
      throw Exception(errorBody['error'] ?? 'Failed to save microblog (${response.statusCode})');
    }
  }

  // Delete single Microblog
  static Future<bool> deleteMicroblog(String id) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/microblogs/$id');
    final headers = await _getHeaders();

    final response = await http.delete(uri, headers: headers).timeout(timeoutDuration);
    return response.statusCode == 200;
  }

  // Batch Delete Microblogs
  static Future<bool> deleteMicroblogsBatch(List<String> ids) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/microblogs/batch-delete');
    final headers = await _getHeaders();

    final response = await http
        .post(
          uri,
          headers: headers,
          body: jsonEncode({'ids': ids}),
        )
        .timeout(timeoutDuration);

    return response.statusCode == 200;
  }

  // Fetch Locations
  static Future<List<LocationRecord>> getLocations() async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/locations');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final list = (data['locations'] as List? ?? data as List? ?? []);
        return list.map((e) => LocationRecord.fromJson(e)).toList();
      }
    } catch (e) {
      // Fallback empty list on error
    }
    return [];
  }

  // Fetch Trips
  static Future<List<TripRecord>> getTrips() async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/trips');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final list = (data['trips'] as List? ?? data as List? ?? []);
        return list.map((e) => TripRecord.fromJson(e)).toList();
      }
    } catch (e) {
      // Fallback empty list on error
    }
    return [];
  }

  // Fetch Social Providers Connected Status
  static Future<SocialStatus> getSocialStatus() async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/sync/social-status');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return SocialStatus.fromJson(data);
      }
    } catch (e) {
      // Fallback
    }
    return SocialStatus(blueskyConnected: true, mastodonConnected: true);
  }

  // Trigger Vercel Deploy Hook
  static Future<bool> triggerDeploy() async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/deploy');
      final headers = await _getHeaders();

      final response = await http.post(uri, headers: headers).timeout(timeoutDuration);
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  // Upload image file to server / Cloudinary
  static Future<String> uploadImage(String filePath, String fileName, List<int> bytes) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/upload');
    final token = await AppStorage.getAuthToken();

    final request = http.MultipartRequest('POST', uri);
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    request.files.add(http.MultipartFile.fromBytes(
      'file',
      bytes,
      filename: fileName,
    ));

    final streamedResponse = await request.send().timeout(const Duration(seconds: 30));
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return data['url'] as String;
    } else {
      final errorData = jsonDecode(response.body);
      throw Exception(errorData['error'] ?? 'Upload failed (${response.statusCode})');
    }
  }

  // --- JOURNAL MODULE API ENDPOINTS ---

  static Future<Map<String, dynamic>> getJournalStatus() async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/journal/status');
    final headers = await _getHeaders();

    final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to fetch journal status (${response.statusCode})');
  }

  static Future<JournalKeyRecord> saveJournalKeyRecord(Map<String, dynamic> input) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/journal/keys');
    final headers = await _getHeaders();

    final response = await http.post(uri, headers: headers, body: jsonEncode(input)).timeout(timeoutDuration);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return JournalKeyRecord.fromJson(jsonDecode(response.body));
    }
    throw Exception('Failed to save journal keys (${response.statusCode})');
  }

  static Future<JournalSettingsRecord> saveJournalSettings(Map<String, dynamic> input) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/journal/settings');
    final headers = await _getHeaders();

    final response = await http.post(uri, headers: headers, body: jsonEncode(input)).timeout(timeoutDuration);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return JournalSettingsRecord.fromJson(jsonDecode(response.body));
    }
    throw Exception('Failed to save journal settings (${response.statusCode})');
  }

  static Future<List<JournalEntryRecord>> getJournalEntries() async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/journal/entries');
    final headers = await _getHeaders();

    final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final list = (data['entries'] as List? ?? []);
      return list.map((e) => JournalEntryRecord.fromJson(e)).toList();
    }
    throw Exception('Failed to fetch journal entries (${response.statusCode})');
  }

  static Future<JournalEntryRecord> createJournalEntry(Map<String, dynamic> input) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/journal/entries');
    final headers = await _getHeaders();

    final response = await http.post(uri, headers: headers, body: jsonEncode(input)).timeout(timeoutDuration);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return JournalEntryRecord.fromJson(jsonDecode(response.body));
    }
    throw Exception('Failed to create journal entry (${response.statusCode})');
  }

  static Future<JournalEntryRecord> updateJournalEntry(String id, Map<String, dynamic> input) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/journal/entries/$id');
    final headers = await _getHeaders();

    final response = await http.put(uri, headers: headers, body: jsonEncode(input)).timeout(timeoutDuration);
    if (response.statusCode == 200) {
      return JournalEntryRecord.fromJson(jsonDecode(response.body));
    }
    throw Exception('Failed to update journal entry (${response.statusCode})');
  }

  static Future<bool> deleteJournalEntry(String id) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/journal/entries/$id');
    final headers = await _getHeaders();

    final response = await http.delete(uri, headers: headers).timeout(timeoutDuration);
    return response.statusCode == 200;
  }

  static Future<Map<String, dynamic>> getJournalPickersData() async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/journal/pickers');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (_) {}
    return {'locations': [], 'trips': [], 'people': [], 'projects': []};
  }

  static Future<Map<String, dynamic>> getJournalContextData(String dateStr) async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/journal/context?date=$dateStr');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (_) {}
    return {'moviesCount': 0, 'scrobblesCount': 0, 'photosCount': 0, 'microblogsCount': 0};
  }

  // --- JOURNAL ASSETS ENDPOINTS ---

  static Future<List<JournalAssetRecord>> getJournalAssets(String entryId) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/journal/assets?entryId=$entryId');
    final headers = await _getHeaders();

    final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final list = (data['assets'] as List? ?? []);
      return list.map((e) => JournalAssetRecord.fromJson(e)).toList();
    }
    return [];
  }

  static Future<Map<String, dynamic>> uploadRawEncryptedAsset(List<int> bytes, String fileName) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/upload/raw');
    final token = await AppStorage.getAuthToken();

    final request = http.MultipartRequest('POST', uri);
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    request.files.add(http.MultipartFile.fromBytes(
      'file',
      bytes,
      filename: fileName,
    ));
    request.fields['fileName'] = fileName;

    final streamedResponse = await request.send().timeout(const Duration(seconds: 45));
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to upload raw asset (${response.statusCode})');
  }

  static Future<JournalAssetRecord> createJournalAssetRecord(Map<String, dynamic> input) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/journal/assets');
    final headers = await _getHeaders();

    final response = await http.post(uri, headers: headers, body: jsonEncode(input)).timeout(timeoutDuration);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return JournalAssetRecord.fromJson(jsonDecode(response.body));
    }
    throw Exception('Failed to create journal asset record (${response.statusCode})');
  }

  static Future<bool> deleteJournalAssetRecord(String assetId) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/journal/assets?assetId=$assetId');
    final headers = await _getHeaders();

    final response = await http.delete(uri, headers: headers).timeout(timeoutDuration);
    return response.statusCode == 200;
  }

  static Future<List<int>> downloadRawEncryptedAsset(String publicId) async {
    final cloudName = 'dhz4kwmsy'; // Standard Cloudinary cloud name fallback
    final url = 'https://res.cloudinary.com/$cloudName/raw/upload/$publicId';

    final response = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 30));
    if (response.statusCode == 200) {
      return response.bodyBytes;
    }
    // Attempt fallback auto/upload
    final autoUrl = 'https://res.cloudinary.com/$cloudName/auto/upload/$publicId';
    final fallbackRes = await http.get(Uri.parse(autoUrl)).timeout(const Duration(seconds: 30));
    if (fallbackRes.statusCode == 200) {
      return fallbackRes.bodyBytes;
    }
    throw Exception('Failed to download encrypted asset HTTP ${response.statusCode}');
  }
}
