import '../models/trip_record.dart';

/// Dart ports of `src/features/trips/trip-helpers.ts` — pure helpers that power
/// 0ms in-memory search / sort / filter and client-side display derivation.

const List<String> kMonthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/// Parse an ISO date (YYYY-MM-DD) into calendar parts without timezone drift.
({int year, int month, int day})? parseCalendarDateParts(String? dateStr) {
  if (dateStr == null || dateStr.trim().isEmpty) return null;
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(dateStr.trim());
  if (match == null) return null;
  final year = int.parse(match.group(1)!);
  final month = int.parse(match.group(2)!);
  final day = int.parse(match.group(3)!);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return (year: year, month: month, day: day);
}

String formatCalendarDate(String? dateStr) {
  if (dateStr == null || dateStr.isEmpty) return '';
  final parts = parseCalendarDateParts(dateStr);
  if (parts == null) return dateStr;
  return '${kMonthNames[parts.month - 1]} ${parts.day}, ${parts.year}';
}

/// e.g. "Sep 22 – Sep 29, 2026" or "Dec 28, 2025 – Jan 4, 2026".
String formatTripDateRange(String? startDate, String? endDate) {
  final hasStart = startDate != null && startDate.isNotEmpty;
  final hasEnd = endDate != null && endDate.isNotEmpty;
  if (!hasStart && !hasEnd) return 'Dates not set';
  if (hasStart && !hasEnd) return 'From ${formatCalendarDate(startDate)}';
  if (!hasStart && hasEnd) return 'Until ${formatCalendarDate(endDate)}';

  final s = parseCalendarDateParts(startDate);
  final e = parseCalendarDateParts(endDate);
  if (s == null || e == null) {
    return [startDate, endDate].where((v) => v != null && v.isNotEmpty).join(' – ');
  }

  final sMonth = kMonthNames[s.month - 1];
  final eMonth = kMonthNames[e.month - 1];

  if (s.year == e.year) {
    if (s.month == e.month && s.day == e.day) {
      return '$sMonth ${s.day}, ${s.year}';
    }
    return '$sMonth ${s.day} – $eMonth ${e.day}, ${s.year}';
  }
  return '$sMonth ${s.day}, ${s.year} – $eMonth ${e.day}, ${e.year}';
}

/// Inclusive calendar-day duration (end - start + 1). Falls back to 1.
int computeTripDuration(String? startDate, String? endDate) {
  if (startDate == null || endDate == null) return 1;
  final s = parseCalendarDateParts(startDate);
  final e = parseCalendarDateParts(endDate);
  if (s == null || e == null) return 1;

  final sUtc = DateTime.utc(s.year, s.month, s.day);
  final eUtc = DateTime.utc(e.year, e.month, e.day);
  if (eUtc.isBefore(sUtc)) return 1;

  final diffDays = eUtc.difference(sUtc).inDays + 1;
  return diffDays < 1 ? 1 : diffDays;
}

/// "Durgapur-Ranchi-Delhi" -> "Durgapur → Ranchi → Delhi".
String formatTripDisplayTitle(String? title) {
  if (title == null) return '';
  final trimmed = title.trim();
  if (trimmed.isEmpty) return '';

  if (trimmed.contains('→') || trimmed.contains('->')) {
    return trimmed.replaceAll('->', ' → ').replaceAll(RegExp(r'\s+→\s+'), ' → ');
  }

  if (RegExp(r'^[A-Z][a-zA-Z0-9\s]+(-[A-Z][a-zA-Z0-9\s]+)+$').hasMatch(trimmed)) {
    return trimmed.split('-').map((s) => s.trim()).join(' → ');
  }
  return trimmed;
}

/// Clamped itinerary completion percentage (0–100).
int computeItineraryProgress(int plannedDays, int totalDays) {
  if (totalDays <= 0) return 0;
  final ratio = plannedDays / totalDays;
  final pct = (ratio * 100).round();
  return pct < 0 ? 0 : (pct > 100 ? 100 : pct);
}

/// Deterministic cover theme ('one'|'two'|'three'|'four') from id/slug hash.
String getDeterministicCoverTheme(String idOrSlug) {
  const themes = ['one', 'two', 'three', 'four'];
  int hash = 0;
  for (int i = 0; i < idOrSlug.length; i++) {
    hash = (hash * 31 + idOrSlug.codeUnitAt(i)) & 0xffffffff;
  }
  return themes[hash.abs() % themes.length];
}

/// Does a trip match the active status filter chip?
/// filter ∈ {all, upcoming, ongoing, completed, favorites}.
bool isTripMatchingFilter(TripRecord trip, String filter, {String? todayIso}) {
  if (filter == 'all') return true;
  if (filter == 'favorites') return trip.favorite;
  if (filter == 'completed') return trip.status == 'completed';
  if (filter == 'ongoing') return trip.status == 'ongoing';

  if (filter == 'upcoming') {
    if (trip.status == 'cancelled') return false;
    if (trip.status == 'planned') return true;
    if (todayIso != null &&
        trip.startDate != null &&
        trip.startDate!.compareTo(todayIso) > 0 &&
        trip.status != 'completed') {
      return true;
    }
    return false;
  }
  return true;
}

List<TripRecord> sortTripOverviewItems(List<TripRecord> items, String sort) {
  final cloned = List<TripRecord>.from(items);
  cloned.sort((a, b) {
    switch (sort) {
      case 'oldest':
        return (a.startDate ?? a.createdAt).compareTo(b.startDate ?? b.createdAt);
      case 'duration':
        if (b.duration != a.duration) return b.duration - a.duration;
        return (b.startDate ?? b.createdAt).compareTo(a.startDate ?? a.createdAt);
      case 'title':
        return a.title.toLowerCase().compareTo(b.title.toLowerCase());
      case 'recent':
      default:
        return (b.startDate ?? b.createdAt).compareTo(a.startDate ?? a.createdAt);
    }
  });
  return cloned;
}

List<TripRecord> filterAndSortTrips(
  List<TripRecord> items,
  String query,
  String filter,
  String sort, {
  String? todayIso,
}) {
  final cleanQ = query.trim().toLowerCase();
  final filtered = items.where((trip) {
    if (!isTripMatchingFilter(trip, filter, todayIso: todayIso)) return false;
    if (cleanQ.isEmpty) return true;
    final searchable = [
      trip.title,
      trip.displayTitle,
      trip.description ?? '',
      ...trip.locationNames,
      ...trip.tags,
      trip.status,
    ].join(' ').toLowerCase();
    return searchable.contains(cleanQ);
  }).toList();
  return sortTripOverviewItems(filtered, sort);
}

/// Featured trip: favorite+completed → any favorite → most recent → null.
TripRecord? selectFeaturedTrip(List<TripRecord> items) {
  if (items.isEmpty) return null;

  for (final t in items) {
    if (t.favorite && t.status == 'completed') return t;
  }
  for (final t in items) {
    if (t.favorite) return t;
  }

  final sorted = List<TripRecord>.from(items)
    ..sort((a, b) {
      final aVal = a.updatedAt.isNotEmpty ? a.updatedAt : (a.startDate ?? a.createdAt);
      final bVal = b.updatedAt.isNotEmpty ? b.updatedAt : (b.startDate ?? b.createdAt);
      return bVal.compareTo(aVal);
    });
  return sorted.isNotEmpty ? sorted.first : null;
}
