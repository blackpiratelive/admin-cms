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

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'subtitle': subtitle,
    'type': type,
  };

  factory PickerItem.fromJson(Map<String, dynamic> json) => PickerItem(
    id: json['id'] as String? ?? '',
    title: json['title'] as String? ?? '',
    subtitle: json['subtitle'] as String?,
    type: json['type'] as String? ?? 'location',
  );
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

  Map<String, dynamic> toJson() => {
    'locations': locations.map((e) => e.toJson()).toList(),
    'trips': trips.map((e) => e.toJson()).toList(),
    'projects': projects.map((e) => e.toJson()).toList(),
    'microblogs': microblogs.map((e) => e.toJson()).toList(),
    'photos': photos.map((e) => e.toJson()).toList(),
    'collections': collections.map((e) => e.toJson()).toList(),
  };

  factory PeoplePickersResult.fromCachedJson(Map<String, dynamic> json) {
    List<PickerItem> parseList(String key) {
      final list = json[key] as List<dynamic>? ?? [];
      return list.map((e) => PickerItem.fromJson(e as Map<String, dynamic>)).toList();
    }
    return PeoplePickersResult(
      locations: parseList('locations'),
      trips: parseList('trips'),
      projects: parseList('projects'),
      microblogs: parseList('microblogs'),
      photos: parseList('photos'),
      collections: parseList('collections'),
    );
  }

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
