import 'package:flutter_cache_manager/flutter_cache_manager.dart';

class PeopleImageCacheManager {
  static const String key = 'people_app_image_cache';

  static final CacheManager instance = CacheManager(
    Config(
      key,
      stalePeriod: const Duration(days: 90),
      maxNrOfCacheObjects: 2000,
      repo: JsonCacheInfoRepository(databaseName: key),
      fileService: HttpFileService(),
    ),
  );

  /// Asynchronously pre-caches an image in the background without throwing errors
  static Future<void> precacheImage(String url) async {
    final clean = url.trim();
    if (clean.isEmpty || !clean.startsWith('http')) return;
    try {
      await instance.downloadFile(clean);
    } catch (_) {
      // Silently ignore network or download failures in background pre-cacher
    }
  }

  /// Asynchronously pre-caches multiple image URLs in the background
  static void precacheImages(List<String> urls) {
    for (final url in urls) {
      precacheImage(url);
    }
  }

  /// Clears the persistent disk image cache
  static Future<void> clearCache() async {
    await instance.emptyCache();
  }
}
