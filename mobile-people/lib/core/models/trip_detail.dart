import 'trip_record.dart';
import 'trip_day.dart';

/// Composite payload for `GET /api/trips/[id]` — trip + itinerary days +
/// connected entities + ordered map route. Mirrors the web Trip hub.

class TripMapStop {
  final String id;
  final String name;
  final String slug;
  final String? city;
  final String? state;
  final String? country;
  final double? latitude;
  final double? longitude;
  final int order;
  final bool isPrimary;
  final int? dayNumber;
  final String? stopType;
  final bool isAssociatedLocation;
  final String? transportMode;

  const TripMapStop({
    required this.id,
    required this.name,
    this.slug = '',
    this.city,
    this.state,
    this.country,
    this.latitude,
    this.longitude,
    this.order = 0,
    this.isPrimary = false,
    this.dayNumber,
    this.stopType,
    this.isAssociatedLocation = false,
    this.transportMode,
  });

  bool get hasCoords => latitude != null && longitude != null;

  String get locationLabel =>
      [city, state, country].where((v) => v != null && v.isNotEmpty).join(', ');

  factory TripMapStop.fromJson(Map<String, dynamic> j) => TripMapStop(
        id: j['id'] as String? ?? '',
        name: j['name'] as String? ?? 'Stop',
        slug: j['slug'] as String? ?? '',
        city: j['city'] as String?,
        state: j['state'] as String?,
        country: j['country'] as String?,
        latitude: (j['latitude'] as num?)?.toDouble(),
        longitude: (j['longitude'] as num?)?.toDouble(),
        order: j['order'] as int? ?? 0,
        isPrimary: j['isPrimary'] == true,
        dayNumber: j['dayNumber'] as int?,
        stopType: j['stopType'] as String?,
        isAssociatedLocation: j['isAssociatedLocation'] == true,
        transportMode: j['transportMode'] as String?,
      );
}

class TripPhoto {
  final String id;
  final String title;
  final String? thumbnailUrl;
  final String? mediumUrl;
  final String? largeUrl;
  final String? originalUrl;
  final String sourceType; // direct | attachment | day
  final int? sourceDayNumber;

  const TripPhoto({
    required this.id,
    this.title = 'Photo',
    this.thumbnailUrl,
    this.mediumUrl,
    this.largeUrl,
    this.originalUrl,
    this.sourceType = 'direct',
    this.sourceDayNumber,
  });

  String get thumbUrl => thumbnailUrl ?? mediumUrl ?? originalUrl ?? largeUrl ?? '';
  String get fullUrl => originalUrl ?? largeUrl ?? mediumUrl ?? thumbnailUrl ?? '';

  factory TripPhoto.fromJson(Map<String, dynamic> j) {
    final day = j['sourceDay'] as Map<String, dynamic>?;
    return TripPhoto(
      id: j['id'] as String? ?? '',
      title: j['title'] as String? ?? 'Photo',
      thumbnailUrl: j['thumbnailUrl'] as String?,
      mediumUrl: j['mediumUrl'] as String?,
      largeUrl: j['largeUrl'] as String?,
      originalUrl: j['originalUrl'] as String?,
      sourceType: j['sourceType'] as String? ?? 'direct',
      sourceDayNumber: day?['dayNumber'] as int?,
    );
  }
}

class TripLocationRef {
  final String? relationshipId;
  final String id;
  final String name;
  final String slug;
  final String? city;
  final String? country;
  final double? latitude;
  final double? longitude;

  const TripLocationRef({
    this.relationshipId,
    required this.id,
    required this.name,
    this.slug = '',
    this.city,
    this.country,
    this.latitude,
    this.longitude,
  });

  String get subtitle =>
      [city, country].where((v) => v != null && v.isNotEmpty).join(', ');

  factory TripLocationRef.fromJson(Map<String, dynamic> j) {
    final loc = j['location'] as Map<String, dynamic>? ?? j;
    return TripLocationRef(
      relationshipId: j['relationshipId'] as String?,
      id: loc['id'] as String? ?? '',
      name: loc['name'] as String? ?? 'Location',
      slug: loc['slug'] as String? ?? '',
      city: loc['city'] as String?,
      country: loc['country'] as String?,
      latitude: (loc['latitude'] as num?)?.toDouble(),
      longitude: (loc['longitude'] as num?)?.toDouble(),
    );
  }
}

class TripPersonRef {
  final String? relationshipId;
  final String id;
  final String displayName;
  final String slug;
  final String? avatarUrl;
  final String relationshipType;

  const TripPersonRef({
    this.relationshipId,
    required this.id,
    required this.displayName,
    this.slug = '',
    this.avatarUrl,
    this.relationshipType = 'Friend',
  });

  String get initials {
    final clean = displayName.trim();
    if (clean.isEmpty) return '?';
    final parts = clean.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return clean.substring(0, 1).toUpperCase();
  }

  bool get hasAvatar => avatarUrl != null && avatarUrl!.trim().isNotEmpty;

  factory TripPersonRef.fromJson(Map<String, dynamic> j) {
    final p = j['person'] as Map<String, dynamic>? ?? j;
    return TripPersonRef(
      relationshipId: j['relationshipId'] as String?,
      id: p['id'] as String? ?? '',
      displayName: (p['displayName'] as String? ?? p['name'] as String? ?? '').trim(),
      slug: p['slug'] as String? ?? '',
      avatarUrl: p['avatarUrl'] as String?,
      relationshipType: p['relationshipType'] as String? ?? 'Friend',
    );
  }
}

class TripMicroblog {
  final String id;
  final String slug;
  final String contentMarkdown;
  final String status;
  final String? coverImageUrl;
  final String? createdAt;

  const TripMicroblog({
    required this.id,
    this.slug = '',
    this.contentMarkdown = '',
    this.status = 'draft',
    this.coverImageUrl,
    this.createdAt,
  });

  factory TripMicroblog.fromJson(Map<String, dynamic> j) => TripMicroblog(
        id: j['id'] as String? ?? '',
        slug: j['slug'] as String? ?? '',
        contentMarkdown: j['contentMarkdown'] as String? ?? '',
        status: j['status'] as String? ?? 'draft',
        coverImageUrl: j['coverImageUrl'] as String?,
        createdAt: j['createdAt'] as String?,
      );
}

class TripMovie {
  final int? traktId;
  final String title;
  final int? year;
  final String? posterPath;

  const TripMovie({this.traktId, required this.title, this.year, this.posterPath});

  /// Resolve a TMDB poster path to a displayable URL.
  String? get posterUrl {
    if (posterPath == null || posterPath!.isEmpty) return null;
    if (posterPath!.startsWith('http')) return posterPath;
    return 'https://image.tmdb.org/t/p/w342$posterPath';
  }

  factory TripMovie.fromJson(Map<String, dynamic> j) => TripMovie(
        traktId: j['traktId'] as int?,
        title: j['title'] as String? ?? 'Untitled',
        year: j['year'] as int?,
        posterPath: j['posterPath'] as String?,
      );
}

class TripDetailResult {
  final TripRecord trip;
  final List<TripDay> days;
  final List<TripLocationRef> locations;
  final List<TripMicroblog> microblogs;
  final List<TripPhoto> photos;
  final List<TripPersonRef> people;
  final List<TripMovie> movies;
  final List<TripMapStop> routeStops;
  final List<TripMapStop> missingCoords;

  const TripDetailResult({
    required this.trip,
    this.days = const [],
    this.locations = const [],
    this.microblogs = const [],
    this.photos = const [],
    this.people = const [],
    this.movies = const [],
    this.routeStops = const [],
    this.missingCoords = const [],
  });

  static List<Map<String, dynamic>> _list(dynamic raw) =>
      (raw as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();

  factory TripDetailResult.fromJson(Map<String, dynamic> json) {
    final entities = json['entities'] as Map<String, dynamic>? ?? {};
    final map = json['map'] as Map<String, dynamic>? ?? {};

    return TripDetailResult(
      trip: TripRecord.fromJson(json['trip'] as Map<String, dynamic>),
      days: _list(json['days']).map(TripDay.fromJson).toList(),
      locations: _list(entities['associatedLocations']).map(TripLocationRef.fromJson).toList(),
      microblogs: _list(entities['microblogs']).map(TripMicroblog.fromJson).toList(),
      photos: _list(entities['photos']).map(TripPhoto.fromJson).toList(),
      people: _list(entities['people']).map(TripPersonRef.fromJson).toList(),
      movies: _list(entities['movies']).map(TripMovie.fromJson).toList(),
      routeStops: _list(map['routeStops']).map(TripMapStop.fromJson).toList(),
      missingCoords: _list(map['missingCoords']).map(TripMapStop.fromJson).toList(),
    );
  }
}
