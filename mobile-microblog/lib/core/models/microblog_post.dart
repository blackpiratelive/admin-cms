import 'dart:convert';

class MicroblogPost {
  final String id;
  final String slug;
  final String contentMarkdown;
  final String status; // 'draft', 'published', 'scheduled', 'archived'
  final List<String> tags;
  final String? coverImageUrl;
  final String? shortUrl;
  final String? locationId;
  final String? locationName;
  final String? locationCity;
  final String? tripId;
  final String? tripTitle;
  final List<String> images;
  final DateTime createdAt;
  final DateTime? publishedAt;
  final DateTime updatedAt;

  MicroblogPost({
    required this.id,
    required this.slug,
    required this.contentMarkdown,
    required this.status,
    required this.tags,
    this.coverImageUrl,
    this.shortUrl,
    this.locationId,
    this.locationName,
    this.locationCity,
    this.tripId,
    this.tripTitle,
    required this.images,
    required this.createdAt,
    this.publishedAt,
    required this.updatedAt,
  });

  bool get isPublished => status == 'published';
  bool get isDraft => status == 'draft';

  factory MicroblogPost.fromJson(Map<String, dynamic> json) {
    List<String> parseList(dynamic val) {
      if (val == null) return [];
      if (val is List) return val.map((e) => e.toString()).toList();
      if (val is String) {
        try {
          final decoded = jsonDecode(val);
          if (decoded is List) return decoded.map((e) => e.toString()).toList();
        } catch (_) {
          return val
              .split(',')
              .map((e) => e.trim())
              .where((e) => e.isNotEmpty)
              .toList();
        }
      }
      return [];
    }

    DateTime parseDate(dynamic val, [DateTime? fallback]) {
      if (val == null || val.toString().isEmpty) {
        return fallback ?? DateTime.now();
      }
      try {
        return DateTime.parse(val.toString());
      } catch (_) {
        return fallback ?? DateTime.now();
      }
    }

    final created = parseDate(json['createdAt']);

    final locName = json['locationName']?.toString() ??
        (json['location'] is Map ? json['location']['name']?.toString() : null);
    final locCity = json['locationCity']?.toString() ??
        (json['location'] is Map ? json['location']['city']?.toString() : null);
    final tripName = json['tripTitle']?.toString() ??
        (json['trip'] is Map ? json['trip']['title']?.toString() : null);

    return MicroblogPost(
      id: json['id']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      contentMarkdown: json['contentMarkdown']?.toString() ??
          json['content']?.toString() ??
          '',
      status: json['status']?.toString() ?? 'draft',
      tags: parseList(json['tags']),
      coverImageUrl: json['coverImageUrl']?.toString(),
      shortUrl: json['shortUrl']?.toString(),
      locationId: json['locationId']?.toString(),
      locationName: locName,
      locationCity: locCity,
      tripId: json['tripId']?.toString(),
      tripTitle: tripName,
      images: parseList(json['images']),
      createdAt: created,
      publishedAt: json['publishedAt'] != null
          ? parseDate(json['publishedAt'])
          : null,
      updatedAt: parseDate(json['updatedAt'], created),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'slug': slug,
      'contentMarkdown': contentMarkdown,
      'status': status,
      'tags': tags,
      'coverImageUrl': coverImageUrl,
      'shortUrl': shortUrl,
      'locationId': locationId,
      'locationName': locationName,
      'locationCity': locationCity,
      'tripId': tripId,
      'tripTitle': tripTitle,
      'images': images,
      'createdAt': createdAt.toIso8601String(),
      'publishedAt': publishedAt?.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  MicroblogPost copyWith({
    String? id,
    String? slug,
    String? contentMarkdown,
    String? status,
    List<String>? tags,
    String? coverImageUrl,
    String? shortUrl,
    String? locationId,
    String? locationName,
    String? locationCity,
    String? tripId,
    String? tripTitle,
    List<String>? images,
    DateTime? createdAt,
    DateTime? publishedAt,
    DateTime? updatedAt,
  }) {
    return MicroblogPost(
      id: id ?? this.id,
      slug: slug ?? this.slug,
      contentMarkdown: contentMarkdown ?? this.contentMarkdown,
      status: status ?? this.status,
      tags: tags ?? this.tags,
      coverImageUrl: coverImageUrl ?? this.coverImageUrl,
      shortUrl: shortUrl ?? this.shortUrl,
      locationId: locationId ?? this.locationId,
      locationName: locationName ?? this.locationName,
      locationCity: locationCity ?? this.locationCity,
      tripId: tripId ?? this.tripId,
      tripTitle: tripTitle ?? this.tripTitle,
      images: images ?? this.images,
      createdAt: createdAt ?? this.createdAt,
      publishedAt: publishedAt ?? this.publishedAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class MicroblogFetchResult {
  final List<MicroblogPost> items;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  MicroblogFetchResult({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  factory MicroblogFetchResult.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List? ?? json['posts'] as List? ?? [];
    final itemsList = rawItems
        .map((item) => MicroblogPost.fromJson(item as Map<String, dynamic>))
        .toList();

    return MicroblogFetchResult(
      items: itemsList,
      total: (json['total'] as num?)?.toInt() ?? itemsList.length,
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 50,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}

