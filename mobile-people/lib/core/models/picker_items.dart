class PickerItem {
  final String id;
  final String title;
  final String? subtitle;
  final String type; // 'location', 'trip', 'project', 'microblog', 'gallery', 'collection'

  const PickerItem({
    required this.id,
    required this.title,
    this.subtitle,
    required this.type,
  });
}

class PeoplePickersResult {
  final List<PickerItem> locations;
  final List<PickerItem> trips;
  final List<PickerItem> projects;
  final List<PickerItem> microblogs;
  final List<PickerItem> photos;
  final List<PickerItem> collections;

  const PeoplePickersResult({
    this.locations = const [],
    this.trips = const [],
    this.projects = const [],
    this.microblogs = const [],
    this.photos = const [],
    this.collections = const [],
  });

  factory PeoplePickersResult.fromJson(Map<String, dynamic> json) {
    final rawLocs = json['locations'] as List<dynamic>? ?? [];
    final rawTrips = json['trips'] as List<dynamic>? ?? [];
    final rawPrjs = json['projects'] as List<dynamic>? ?? [];
    final rawMblogs = json['microblogs'] as List<dynamic>? ?? [];
    final rawPhotos = json['photos'] as List<dynamic>? ?? [];
    final rawCols = json['collections'] as List<dynamic>? ?? [];

    return PeoplePickersResult(
      locations: rawLocs.map((e) {
        final m = e as Map<String, dynamic>;
        final city = m['city'] as String?;
        final country = m['country'] as String?;
        String? sub;
        if (city != null && country != null) {
          sub = '$city, $country';
        } else {
          sub = city ?? country;
        }
        return PickerItem(
          id: m['id'] as String? ?? '',
          title: m['name'] as String? ?? 'Location',
          subtitle: sub,
          type: 'location',
        );
      }).toList(),
      trips: rawTrips.map((e) {
        final m = e as Map<String, dynamic>;
        return PickerItem(
          id: m['id'] as String? ?? '',
          title: m['title'] as String? ?? 'Trip',
          subtitle: m['startDate'] as String?,
          type: 'trip',
        );
      }).toList(),
      projects: rawPrjs.map((e) {
        final m = e as Map<String, dynamic>;
        return PickerItem(
          id: m['id'] as String? ?? '',
          title: m['name'] as String? ?? 'Project',
          subtitle: m['status'] as String?,
          type: 'project',
        );
      }).toList(),
      microblogs: rawMblogs.map((e) {
        final m = e as Map<String, dynamic>;
        final content = m['contentMarkdown'] as String? ?? '';
        return PickerItem(
          id: m['id'] as String? ?? '',
          title: m['slug'] as String? ?? 'Post',
          subtitle: content.length > 50 ? '${content.substring(0, 50)}...' : content,
          type: 'microblog',
        );
      }).toList(),
      photos: rawPhotos.map((e) {
        final m = e as Map<String, dynamic>;
        return PickerItem(
          id: m['id'] as String? ?? '',
          title: m['title'] as String? ?? 'Photo',
          subtitle: m['thumbnailUrl'] as String? ?? m['mediumUrl'] as String?,
          type: 'gallery',
        );
      }).toList(),
      collections: rawCols.map((e) {
        final m = e as Map<String, dynamic>;
        return PickerItem(
          id: m['id'] as String? ?? '',
          title: m['name'] as String? ?? 'Collection',
          subtitle: m['description'] as String?,
          type: 'collection',
        );
      }).toList(),
    );
  }

  List<PickerItem> getByType(String type) {
    switch (type) {
      case 'location':
        return locations;
      case 'trip':
        return trips;
      case 'project':
        return projects;
      case 'microblog':
        return microblogs;
      case 'gallery':
      case 'photo':
        return photos;
      case 'collection':
        return collections;
      default:
        return [];
    }
  }
}
