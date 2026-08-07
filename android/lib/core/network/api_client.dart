import 'dart:convert';
import 'package:http/http.dart' as http;
import '../storage/app_storage.dart';
import '../models/microblog.dart';
import '../models/location.dart';
import '../models/trip.dart';
import '../models/social_status.dart';

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
}
