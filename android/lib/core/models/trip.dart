class TripRecord {
  final String id;
  final String title;
  final String slug;
  final String? status;

  TripRecord({
    required this.id,
    required this.title,
    required this.slug,
    this.status,
  });

  factory TripRecord.fromJson(Map<String, dynamic> json) {
    return TripRecord(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      slug: json['slug'] ?? '',
      status: json['status'],
    );
  }
}
