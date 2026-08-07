import 'dart:convert';

class Microblog {
  final String id;
  final String slug;
  final String contentMarkdown;
  final String status; // 'draft', 'published', 'scheduled', 'archived'
  final List<String> tags;
  final String? coverImageUrl;
  final String? shortUrl;
  final String? locationId;
  final String? tripId;
  final List<String> images;
  final String createdAt;
  final String? publishedAt;
  final String updatedAt;

  Microblog({
    required this.id,
    required this.slug,
    required this.contentMarkdown,
    required this.status,
    required this.tags,
    this.coverImageUrl,
    this.shortUrl,
    this.locationId,
    this.tripId,
    required this.images,
    required this.createdAt,
    this.publishedAt,
    required this.updatedAt,
  });

  factory Microblog.fromJson(Map<String, dynamic> json) {
    List<String> parseList(dynamic val) {
      if (val == null) return [];
      if (val is List) return val.map((e) => e.toString()).toList();
      if (val is String) {
        try {
          final decoded = jsonDecode(val);
          if (decoded is List) return decoded.map((e) => e.toString()).toList();
        } catch (_) {
          return val.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
        }
      }
      return [];
    }

    return Microblog(
      id: json['id'] ?? '',
      slug: json['slug'] ?? '',
      contentMarkdown: json['contentMarkdown'] ?? json['content'] ?? '',
      status: json['status'] ?? 'draft',
      tags: parseList(json['tags']),
      coverImageUrl: json['coverImageUrl'],
      shortUrl: json['shortUrl'],
      locationId: json['locationId'],
      tripId: json['tripId'],
      images: parseList(json['images']),
      createdAt: json['createdAt'] ?? DateTime.now().toIso8601String(),
      publishedAt: json['publishedAt'],
      updatedAt: json['updatedAt'] ?? json['createdAt'] ?? DateTime.now().toIso8601String(),
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
      'tripId': tripId,
      'images': images,
      'createdAt': createdAt,
      'publishedAt': publishedAt,
      'updatedAt': updatedAt,
    };
  }

  Microblog copyWith({
    String? id,
    String? slug,
    String? contentMarkdown,
    String? status,
    List<String>? tags,
    String? coverImageUrl,
    String? shortUrl,
    String? locationId,
    String? tripId,
    List<String>? images,
    String? createdAt,
    String? publishedAt,
    String? updatedAt,
  }) {
    return Microblog(
      id: id ?? this.id,
      slug: slug ?? this.slug,
      contentMarkdown: contentMarkdown ?? this.contentMarkdown,
      status: status ?? this.status,
      tags: tags ?? this.tags,
      coverImageUrl: coverImageUrl ?? this.coverImageUrl,
      shortUrl: shortUrl ?? this.shortUrl,
      locationId: locationId ?? this.locationId,
      tripId: tripId ?? this.tripId,
      images: images ?? this.images,
      createdAt: createdAt ?? this.createdAt,
      publishedAt: publishedAt ?? this.publishedAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class MicroblogFetchResult {
  final List<Microblog> items;
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
    final itemsList = rawItems.map((item) => Microblog.fromJson(item as Map<String, dynamic>)).toList();

    return MicroblogFetchResult(
      items: itemsList,
      total: json['total'] ?? itemsList.length,
      page: json['page'] ?? 1,
      limit: json['limit'] ?? 50,
      totalPages: json['totalPages'] ?? 1,
    );
  }
}
