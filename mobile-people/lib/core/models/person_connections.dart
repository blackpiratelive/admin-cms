class ConnectedPhoto {
  final String? relationshipId;
  final String relationshipName;
  final String id;
  final String title;
  final String? originalUrl;
  final String? mediumUrl;
  final String? thumbnailUrl;

  const ConnectedPhoto({
    this.relationshipId,
    required this.relationshipName,
    required this.id,
    required this.title,
    this.originalUrl,
    this.mediumUrl,
    this.thumbnailUrl,
  });

  factory ConnectedPhoto.fromJson(Map<String, dynamic> json) {
    final entity = json['entity'] as Map<String, dynamic>? ?? json;
    return ConnectedPhoto(
      relationshipId: json['relationshipId'] as String?,
      relationshipName: json['relationshipName'] as String? ?? 'appears_in',
      id: entity['id'] as String? ?? '',
      title: entity['title'] as String? ?? 'Photo',
      originalUrl: entity['originalUrl'] as String?,
      mediumUrl: entity['mediumUrl'] as String?,
      thumbnailUrl: entity['thumbnailUrl'] as String?,
    );
  }

  String get displayUrl => thumbnailUrl ?? mediumUrl ?? originalUrl ?? '';

  Map<String, dynamic> toJson() => {
    'relationshipId': relationshipId,
    'relationshipName': relationshipName,
    'id': id,
    'title': title,
    'originalUrl': originalUrl,
    'mediumUrl': mediumUrl,
    'thumbnailUrl': thumbnailUrl,
  };
}

class ConnectedLocation {
  final String? relationshipId;
  final String relationshipName;
  final String id;
  final String name;
  final String? city;
  final String? country;

  const ConnectedLocation({
    this.relationshipId,
    required this.relationshipName,
    required this.id,
    required this.name,
    this.city,
    this.country,
  });

  factory ConnectedLocation.fromJson(Map<String, dynamic> json) {
    final entity = json['entity'] as Map<String, dynamic>? ?? json;
    return ConnectedLocation(
      relationshipId: json['relationshipId'] as String?,
      relationshipName: json['relationshipName'] as String? ?? 'visited',
      id: entity['id'] as String? ?? '',
      name: entity['name'] as String? ?? 'Location',
      city: entity['city'] as String?,
      country: entity['country'] as String?,
    );
  }

  String get subtitle {
    if (city != null && country != null) return '$city, $country';
    return city ?? country ?? '';
  }
}

class ConnectedTrip {
  final String? relationshipId;
  final String relationshipName;
  final String id;
  final String title;
  final String? startDate;
  final String? status;

  const ConnectedTrip({
    this.relationshipId,
    required this.relationshipName,
    required this.id,
    required this.title,
    this.startDate,
    this.status,
  });

  factory ConnectedTrip.fromJson(Map<String, dynamic> json) {
    final entity = json['entity'] as Map<String, dynamic>? ?? json;
    return ConnectedTrip(
      relationshipId: json['relationshipId'] as String?,
      relationshipName: json['relationshipName'] as String? ?? 'joined',
      id: entity['id'] as String? ?? '',
      title: entity['title'] as String? ?? 'Trip',
      startDate: entity['startDate'] as String?,
      status: entity['status'] as String?,
    );
  }
}

class ConnectedMicroblog {
  final String? relationshipId;
  final String relationshipName;
  final String id;
  final String contentMarkdown;
  final String? publishedAt;

  const ConnectedMicroblog({
    this.relationshipId,
    required this.relationshipName,
    required this.id,
    required this.contentMarkdown,
    this.publishedAt,
  });

  factory ConnectedMicroblog.fromJson(Map<String, dynamic> json) {
    final entity = json['entity'] as Map<String, dynamic>? ?? json;
    return ConnectedMicroblog(
      relationshipId: json['relationshipId'] as String?,
      relationshipName: json['relationshipName'] as String? ?? 'mentions',
      id: entity['id'] as String? ?? '',
      contentMarkdown: entity['contentMarkdown'] as String? ?? '',
      publishedAt: entity['publishedAt'] as String?,
    );
  }
}

class ConnectedProject {
  final String? relationshipId;
  final String relationshipName;
  final String id;
  final String name;
  final String? status;

  const ConnectedProject({
    this.relationshipId,
    required this.relationshipName,
    required this.id,
    required this.name,
    this.status,
  });

  factory ConnectedProject.fromJson(Map<String, dynamic> json) {
    final entity = json['entity'] as Map<String, dynamic>? ?? json;
    return ConnectedProject(
      relationshipId: json['relationshipId'] as String?,
      relationshipName: json['relationshipName'] as String? ?? 'worked_on',
      id: entity['id'] as String? ?? '',
      name: entity['name'] as String? ?? 'Project',
      status: entity['status'] as String?,
    );
  }
}

class ConnectedCollection {
  final String id;
  final String name;
  final String? description;

  const ConnectedCollection({
    required this.id,
    required this.name,
    this.description,
  });

  factory ConnectedCollection.fromJson(Map<String, dynamic> json) {
    return ConnectedCollection(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Collection',
      description: json['description'] as String?,
    );
  }
}

class PersonConnections {
  final List<ConnectedPhoto> photos;
  final List<ConnectedLocation> locations;
  final List<ConnectedTrip> trips;
  final List<ConnectedMicroblog> microblogs;
  final List<ConnectedProject> projects;
  final List<ConnectedCollection> collections;

  const PersonConnections({
    this.photos = const [],
    this.locations = const [],
    this.trips = const [],
    this.microblogs = const [],
    this.projects = const [],
    this.collections = const [],
  });

  factory PersonConnections.fromJson(Map<String, dynamic> json) {
    final rawPhotos = json['photos'] as List<dynamic>? ?? [];
    final rawLocations = json['locations'] as List<dynamic>? ?? [];
    final rawTrips = json['trips'] as List<dynamic>? ?? [];
    final rawMicroblogs = json['microblogs'] as List<dynamic>? ?? [];
    final rawProjects = json['projects'] as List<dynamic>? ?? [];
    final rawCollections = json['collections'] as List<dynamic>? ?? [];

    return PersonConnections(
      photos: rawPhotos.map((e) => ConnectedPhoto.fromJson(e as Map<String, dynamic>)).toList(),
      locations: rawLocations.map((e) => ConnectedLocation.fromJson(e as Map<String, dynamic>)).toList(),
      trips: rawTrips.map((e) => ConnectedTrip.fromJson(e as Map<String, dynamic>)).toList(),
      microblogs: rawMicroblogs.map((e) => ConnectedMicroblog.fromJson(e as Map<String, dynamic>)).toList(),
      projects: rawProjects.map((e) => ConnectedProject.fromJson(e as Map<String, dynamic>)).toList(),
      collections: rawCollections.map((e) => ConnectedCollection.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  PersonConnections copyWith({
    List<ConnectedPhoto>? photos,
    List<ConnectedLocation>? locations,
    List<ConnectedTrip>? trips,
    List<ConnectedMicroblog>? microblogs,
    List<ConnectedProject>? projects,
    List<ConnectedCollection>? collections,
  }) {
    return PersonConnections(
      photos: photos ?? this.photos,
      locations: locations ?? this.locations,
      trips: trips ?? this.trips,
      microblogs: microblogs ?? this.microblogs,
      projects: projects ?? this.projects,
      collections: collections ?? this.collections,
    );
  }

  Map<String, dynamic> toJson() => {
    'photos': photos.map((e) => e.toJson()).toList(),
    'locations': locations.map((e) => {
      'relationshipId': e.relationshipId,
      'relationshipName': e.relationshipName,
      'id': e.id,
      'name': e.name,
      'city': e.city,
      'country': e.country,
    }).toList(),
    'trips': trips.map((e) => {
      'relationshipId': e.relationshipId,
      'relationshipName': e.relationshipName,
      'id': e.id,
      'title': e.title,
      'startDate': e.startDate,
      'status': e.status,
    }).toList(),
    'microblogs': microblogs.map((e) => {
      'relationshipId': e.relationshipId,
      'relationshipName': e.relationshipName,
      'id': e.id,
      'contentMarkdown': e.contentMarkdown,
      'publishedAt': e.publishedAt,
    }).toList(),
    'projects': projects.map((e) => {
      'relationshipId': e.relationshipId,
      'relationshipName': e.relationshipName,
      'id': e.id,
      'name': e.name,
      'status': e.status,
    }).toList(),
    'collections': collections.map((e) => {
      'id': e.id,
      'name': e.name,
      'description': e.description,
    }).toList(),
  };

  int get totalCount =>
      photos.length + locations.length + trips.length + microblogs.length + projects.length + collections.length;

  bool get isEmpty => totalCount == 0;
  bool get isNotEmpty => !isEmpty;
}
