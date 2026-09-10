import 'dart:convert';
import 'package:http/http.dart' as http;
import '../storage/local_store.dart';
import '../models/microblog_post.dart';
import '../models/location_item.dart';
import '../models/trip_item.dart';

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

  // Fetch Microblogs list
  static Future<MicroblogFetchResult> getPosts({
    String search = '',
    String status = 'all',
    int page = 1,
    int limit = 50,
  }) async {
    final baseUrl = await _getBaseUrl();
    final queryParams = <String, String>{
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
      final result = MicroblogFetchResult.fromJson(data);
      if (page == 1 && search.isEmpty && status == 'all') {
        // Cache initial feed locally
        await LocalStore.saveCachedPosts(result.items);
      }
      return result;
    } else {
      throw Exception('Failed to load microblogs (${response.statusCode})');
    }
  }

  // Create or Update Microblog Post
  static Future<Map<String, dynamic>> savePost(Map<String, dynamic> input) async {
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
      String msg = 'Failed to save microblog (${response.statusCode})';
      try {
        final err = jsonDecode(response.body);
        if (err['error'] != null) msg = err['error'];
      } catch (_) {}
      throw Exception(msg);
    }
  }

  // Delete single Microblog Post
  static Future<bool> deletePost(String id) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/microblogs/$id');
    final headers = await _getHeaders();

    final response = await http.delete(uri, headers: headers).timeout(timeoutDuration);
    return response.statusCode == 200;
  }

  // Fetch single post by ID (for fresh edit state)
  static Future<MicroblogPost?> getPostById(String id) async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/microblogs/$id');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return MicroblogPost.fromJson(data);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // Fetch Locations list
  static Future<List<LocationItem>> getLocations() async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/locations');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final list = data['locations'] as List<dynamic>? ?? [];
        return list.map((e) => LocationItem.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  // Fetch Trips list
  static Future<List<TripItem>> getTrips() async {
    try {
      final baseUrl = await _getBaseUrl();
      final uri = Uri.parse('$baseUrl/api/trips');
      final headers = await _getHeaders();

      final response = await http.get(uri, headers: headers).timeout(timeoutDuration);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final list = data['trips'] as List<dynamic>? ?? [];
        return list.map((e) => TripItem.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  // Upload image to Cloudinary via server
  static Future<String> uploadImage(String fileName, List<int> bytes) async {
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
      throw Exception('Image upload failed (${response.statusCode})');
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
