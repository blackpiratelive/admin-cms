import 'dart:convert';

/// Read models mirroring `src/features/trips/day-helpers.ts` structured JSON.
/// The mobile app renders itinerary days read-only this pass.

class TransportWaypoint {
  final String? locationId;
  final String? name;
  final double? latitude;
  final double? longitude;

  const TransportWaypoint({this.locationId, this.name, this.latitude, this.longitude});

  factory TransportWaypoint.fromJson(Map<String, dynamic> j) => TransportWaypoint(
        locationId: j['locationId'] as String?,
        name: j['name'] as String?,
        latitude: (j['latitude'] as num?)?.toDouble(),
        longitude: (j['longitude'] as num?)?.toDouble(),
      );
}

class TransportLeg {
  final String id;
  final String mode; // walk|bike|bus|train|flight|car|taxi|boat|other
  final String? fromName;
  final String? toName;
  final List<TransportWaypoint> waypoints;
  final String? departTime;
  final String? arriveTime;
  final num? cost;
  final String? currency;
  final String? notes;

  const TransportLeg({
    required this.id,
    this.mode = 'other',
    this.fromName,
    this.toName,
    this.waypoints = const [],
    this.departTime,
    this.arriveTime,
    this.cost,
    this.currency,
    this.notes,
  });

  factory TransportLeg.fromJson(Map<String, dynamic> j) => TransportLeg(
        id: j['id'] as String? ?? '',
        mode: j['mode'] as String? ?? 'other',
        fromName: j['fromName'] as String?,
        toName: j['toName'] as String?,
        waypoints: (j['waypoints'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(TransportWaypoint.fromJson)
            .toList(),
        departTime: j['departTime'] as String?,
        arriveTime: j['arriveTime'] as String?,
        cost: j['cost'] as num?,
        currency: j['currency'] as String?,
        notes: j['notes'] as String?,
      );

  /// Route string e.g. "Paris → Brussels → Amsterdam".
  String get routeLabel {
    final stops = <String>[
      if (fromName != null && fromName!.isNotEmpty) fromName!,
      ...waypoints.where((w) => (w.name ?? '').isNotEmpty).map((w) => w.name!),
      if (toName != null && toName!.isNotEmpty) toName!,
    ];
    return stops.join(' › ');
  }
}

class MealEntry {
  final String id;
  final String type; // breakfast|lunch|dinner|snack|drinks
  final String? place;
  final String? dishes;
  final num? cost;
  final String? currency;
  final num? rating;
  final String? notes;

  const MealEntry({
    required this.id,
    this.type = 'lunch',
    this.place,
    this.dishes,
    this.cost,
    this.currency,
    this.rating,
    this.notes,
  });

  factory MealEntry.fromJson(Map<String, dynamic> j) => MealEntry(
        id: j['id'] as String? ?? '',
        type: j['type'] as String? ?? 'lunch',
        place: j['place'] as String?,
        dishes: j['dishes'] as String?,
        cost: j['cost'] as num?,
        currency: j['currency'] as String?,
        rating: j['rating'] as num?,
        notes: j['notes'] as String?,
      );
}

class ActivityEntry {
  final String id;
  final String title;
  final String? time;
  final String? locationName;
  final num? cost;
  final String? currency;
  final String? notes;

  const ActivityEntry({
    required this.id,
    this.title = '',
    this.time,
    this.locationName,
    this.cost,
    this.currency,
    this.notes,
  });

  factory ActivityEntry.fromJson(Map<String, dynamic> j) => ActivityEntry(
        id: j['id'] as String? ?? '',
        title: j['title'] as String? ?? '',
        time: j['time'] as String?,
        locationName: j['locationName'] as String?,
        cost: j['cost'] as num?,
        currency: j['currency'] as String?,
        notes: j['notes'] as String?,
      );
}

class Accommodation {
  final String? name;
  final String? locationName;
  final num? cost;
  final String? currency;
  final String? notes;

  const Accommodation({this.name, this.locationName, this.cost, this.currency, this.notes});

  factory Accommodation.fromJson(Map<String, dynamic> j) => Accommodation(
        name: j['name'] as String?,
        locationName: j['locationName'] as String?,
        cost: j['cost'] as num?,
        currency: j['currency'] as String?,
        notes: j['notes'] as String?,
      );

  bool get isEmpty =>
      (name == null || name!.isEmpty) &&
      (locationName == null || locationName!.isEmpty) &&
      cost == null;
}

class DayPhoto {
  final String? id;
  final String url;
  final String? caption;

  const DayPhoto({this.id, required this.url, this.caption});

  factory DayPhoto.fromJson(Map<String, dynamic> j) => DayPhoto(
        id: j['id'] as String?,
        url: j['url'] as String? ?? '',
        caption: j['caption'] as String?,
      );
}

class TripDay {
  final String id;
  final String tripId;
  final int dayNumber;
  final String? date;
  final String? title;
  final String? primaryLocationName;
  final List<TransportLeg> transport;
  final List<MealEntry> meals;
  final List<ActivityEntry> activities;
  final Accommodation accommodation;
  final List<DayPhoto> photos;
  final String? weather;
  final int? mood;
  final String? notesMarkdown;

  const TripDay({
    required this.id,
    required this.tripId,
    required this.dayNumber,
    this.date,
    this.title,
    this.primaryLocationName,
    this.transport = const [],
    this.meals = const [],
    this.activities = const [],
    this.accommodation = const Accommodation(),
    this.photos = const [],
    this.weather,
    this.mood,
    this.notesMarkdown,
  });

  static List<Map<String, dynamic>> _decodeList(dynamic raw) {
    if (raw is List) return raw.whereType<Map<String, dynamic>>().toList();
    if (raw is String && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) return decoded.whereType<Map<String, dynamic>>().toList();
      } catch (_) {}
    }
    return const [];
  }

  static Map<String, dynamic> _decodeObject(dynamic raw) {
    if (raw is Map<String, dynamic>) return raw;
    if (raw is String && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) return decoded;
      } catch (_) {}
    }
    return const {};
  }

  factory TripDay.fromJson(Map<String, dynamic> j) => TripDay(
        id: j['id'] as String? ?? '',
        tripId: j['tripId'] as String? ?? '',
        dayNumber: j['dayNumber'] as int? ?? 0,
        date: j['date'] as String?,
        title: j['title'] as String?,
        primaryLocationName: j['primaryLocationName'] as String?,
        transport: _decodeList(j['transportJson']).map(TransportLeg.fromJson).toList(),
        meals: _decodeList(j['mealsJson']).map(MealEntry.fromJson).toList(),
        activities: _decodeList(j['activitiesJson']).map(ActivityEntry.fromJson).toList(),
        accommodation: Accommodation.fromJson(_decodeObject(j['accommodationJson'])),
        photos: _decodeList(j['photosJson']).map(DayPhoto.fromJson).toList(),
        weather: j['weather'] as String?,
        mood: j['mood'] as int?,
        notesMarkdown: j['notesMarkdown'] as String?,
      );

  bool get isDocumented =>
      (title != null && title!.isNotEmpty) ||
      (primaryLocationName != null && primaryLocationName!.isNotEmpty) ||
      (weather != null && weather!.isNotEmpty) ||
      mood != null ||
      (notesMarkdown != null && notesMarkdown!.isNotEmpty) ||
      transport.isNotEmpty ||
      meals.isNotEmpty ||
      activities.isNotEmpty ||
      !accommodation.isEmpty ||
      photos.isNotEmpty;

  /// Per-day spend grouped by currency ('' key = no currency).
  Map<String, num> get costTotals {
    final totals = <String, num>{};
    void add(num? cost, String? currency) {
      if (cost == null || cost == 0) return;
      final key = (currency ?? '').trim();
      totals[key] = (totals[key] ?? 0) + cost;
    }

    for (final l in transport) {
      add(l.cost, l.currency);
    }
    for (final m in meals) {
      add(m.cost, m.currency);
    }
    for (final a in activities) {
      add(a.cost, a.currency);
    }
    add(accommodation.cost, accommodation.currency);
    return totals;
  }
}

/// Format currency-grouped totals, e.g. "₹4,500 + \$30". Empty when no spend.
String formatCostTotals(Map<String, num> totals) {
  final parts = <String>[];
  totals.forEach((cur, amount) {
    if (amount > 0) {
      final formatted = _formatNumber(amount);
      parts.add(cur.isNotEmpty ? '$cur $formatted' : formatted);
    }
  });
  return parts.join(' + ');
}

String _formatNumber(num value) {
  final isInt = value == value.roundToDouble();
  final str = isInt ? value.toStringAsFixed(0) : value.toString();
  // Thousands separators for the integer part.
  final negative = str.startsWith('-');
  final digits = negative ? str.substring(1) : str;
  final dot = digits.indexOf('.');
  final intPart = dot == -1 ? digits : digits.substring(0, dot);
  final frac = dot == -1 ? '' : digits.substring(dot);
  final buf = StringBuffer();
  for (int i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 == 0) buf.write(',');
    buf.write(intPart[i]);
  }
  return '${negative ? '-' : ''}$buf$frac';
}
