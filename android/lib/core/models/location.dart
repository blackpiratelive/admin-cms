class LocationRecord {
  final String id;
  final String name;
  final String slug;
  final String? city;
  final String? country;

  LocationRecord({
    required this.id,
    required this.name,
    required this.slug,
    this.city,
    this.country,
  });

  factory LocationRecord.fromJson(Map<String, dynamic> json) {
    return LocationRecord(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      slug: json['slug'] ?? '',
      city: json['city'],
      country: json['country'],
    );
  }

  String get displayName {
    final parts = [name];
    if (city != null && city!.isNotEmpty) parts.add(city!);
    if (country != null && country!.isNotEmpty) parts.add(country!);
    return parts.join(', ');
  }
}
