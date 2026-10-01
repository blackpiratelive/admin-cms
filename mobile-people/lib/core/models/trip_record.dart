import 'dart:convert';
import '../util/trip_format.dart';

/// Mirrors the web `TripOverviewItem` (src/features/trips/types.ts) while also
/// tolerating raw `trips` records returned by create/update endpoints.
/// Display-only fields are derived client-side when the payload omits them.
class TripRecord {
  final String id;
  final String slug;
  final String title;
  final String displayTitle;
  final String? description;
  final String? startDate;
  final String? endDate;
  final String dateRangeFormatted;
  final int duration;
  final String status; // planned | ongoing | completed | cancelled
  final String visibility; // public | private | unlisted
  final bool favorite;
  final List<String> tags;
  final int placesCount;
  final List<String> locationNames;
  final int photosCount;
  final String? coverImageUrl;
  final String fallbackCoverTheme; // one | two | three | four
  final int itineraryTotalDays;
  final int itineraryPlannedDays;
  final int itineraryProgressPercent;
  final String? spendFormatted;
  final Map<String, num> spendTotals;
  final String createdAt;
  final String updatedAt;

  const TripRecord({
    required this.id,
    required this.slug,
    required this.title,
    required this.displayTitle,
    this.description,
    this.startDate,
    this.endDate,
    this.dateRangeFormatted = '',
    this.duration = 1,
    this.status = 'planned',
    this.visibility = 'public',
    this.favorite = false,
    this.tags = const [],
    this.placesCount = 0,
    this.locationNames = const [],
    this.photosCount = 0,
    this.coverImageUrl,
    this.fallbackCoverTheme = 'one',
    this.itineraryTotalDays = 0,
    this.itineraryPlannedDays = 0,
    this.itineraryProgressPercent = 0,
    this.spendFormatted,
    this.spendTotals = const {},
    this.createdAt = '',
    this.updatedAt = '',
  });

  static bool _parseBool(dynamic raw) =>
      raw == true || raw == 1 || raw == '1';

  static List<String> _parseStringList(dynamic raw) {
    if (raw is List) {
      return raw.map((e) => e.toString().trim()).where((s) => s.isNotEmpty).toList();
    }
    if (raw is String && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          return decoded.map((e) => e.toString().trim()).where((s) => s.isNotEmpty).toList();
        }
      } catch (_) {}
      return raw.split(',').map((e) => e.trim()).where((s) => s.isNotEmpty).toList();
    }
    return const [];
  }

  static Map<String, num> _parseSpendTotals(dynamic raw) {
    if (raw is Map) {
      final out = <String, num>{};
      raw.forEach((k, v) {
        if (v is num) {
          out[k.toString()] = v;
        } else if (v is String) {
          final n = num.tryParse(v);
          if (n != null) out[k.toString()] = n;
        }
      });
      return out;
    }
    return const {};
  }

  factory TripRecord.fromJson(Map<String, dynamic> json) {
    final id = json['id'] as String? ?? '';
    final slug = json['slug'] as String? ?? '';
    final title = (json['title'] as String? ?? '').trim();
    final startDate = json['startDate'] as String?;
    final endDate = json['endDate'] as String?;

    return TripRecord(
      id: id,
      slug: slug,
      title: title,
      displayTitle: (json['displayTitle'] as String?)?.trim().isNotEmpty == true
          ? json['displayTitle'] as String
          : formatTripDisplayTitle(title),
      description: json['description'] as String?,
      startDate: startDate,
      endDate: endDate,
      dateRangeFormatted: (json['dateRangeFormatted'] as String?)?.isNotEmpty == true
          ? json['dateRangeFormatted'] as String
          : formatTripDateRange(startDate, endDate),
      duration: json['duration'] is int
          ? json['duration'] as int
          : computeTripDuration(startDate, endDate),
      status: json['status'] as String? ?? 'planned',
      visibility: json['visibility'] as String? ?? 'public',
      favorite: _parseBool(json['favorite']),
      tags: _parseStringList(json['tags']),
      placesCount: json['placesCount'] as int? ?? 0,
      locationNames: _parseStringList(json['locationNames']),
      photosCount: json['photosCount'] as int? ?? 0,
      coverImageUrl: json['coverImageUrl'] as String?,
      fallbackCoverTheme: json['fallbackCoverTheme'] as String? ??
          getDeterministicCoverTheme(id.isNotEmpty ? id : slug),
      itineraryTotalDays: json['itineraryTotalDays'] as int? ?? 0,
      itineraryPlannedDays: json['itineraryPlannedDays'] as int? ?? 0,
      itineraryProgressPercent: json['itineraryProgressPercent'] as int? ?? 0,
      spendFormatted: json['spendFormatted'] as String?,
      spendTotals: _parseSpendTotals(json['spendTotals']),
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'slug': slug,
        'title': title,
        'displayTitle': displayTitle,
        if (description != null) 'description': description,
        if (startDate != null) 'startDate': startDate,
        if (endDate != null) 'endDate': endDate,
        'dateRangeFormatted': dateRangeFormatted,
        'duration': duration,
        'status': status,
        'visibility': visibility,
        'favorite': favorite ? 1 : 0,
        'tags': tags,
        'placesCount': placesCount,
        'locationNames': locationNames,
        'photosCount': photosCount,
        if (coverImageUrl != null) 'coverImageUrl': coverImageUrl,
        'fallbackCoverTheme': fallbackCoverTheme,
        'itineraryTotalDays': itineraryTotalDays,
        'itineraryPlannedDays': itineraryPlannedDays,
        'itineraryProgressPercent': itineraryProgressPercent,
        if (spendFormatted != null) 'spendFormatted': spendFormatted,
        'spendTotals': spendTotals,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };

  String get initials {
    final clean = title.trim();
    if (clean.isEmpty) return '?';
    final parts = clean.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return clean.substring(0, 1).toUpperCase();
  }

  bool get hasCover => coverImageUrl != null && coverImageUrl!.trim().isNotEmpty;

  TripRecord copyWith({
    String? title,
    String? slug,
    String? description,
    String? startDate,
    String? endDate,
    String? status,
    String? visibility,
    bool? favorite,
    List<String>? tags,
    String? coverImageUrl,
    String? updatedAt,
  }) {
    return TripRecord(
      id: id,
      slug: slug ?? this.slug,
      title: title ?? this.title,
      displayTitle: title != null ? formatTripDisplayTitle(title) : displayTitle,
      description: description ?? this.description,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      dateRangeFormatted: (startDate != null || endDate != null)
          ? formatTripDateRange(startDate ?? this.startDate, endDate ?? this.endDate)
          : dateRangeFormatted,
      duration: (startDate != null || endDate != null)
          ? computeTripDuration(startDate ?? this.startDate, endDate ?? this.endDate)
          : duration,
      status: status ?? this.status,
      visibility: visibility ?? this.visibility,
      favorite: favorite ?? this.favorite,
      tags: tags ?? this.tags,
      placesCount: placesCount,
      locationNames: locationNames,
      photosCount: photosCount,
      coverImageUrl: coverImageUrl ?? this.coverImageUrl,
      fallbackCoverTheme: fallbackCoverTheme,
      itineraryTotalDays: itineraryTotalDays,
      itineraryPlannedDays: itineraryPlannedDays,
      itineraryProgressPercent: itineraryProgressPercent,
      spendFormatted: spendFormatted,
      spendTotals: spendTotals,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
