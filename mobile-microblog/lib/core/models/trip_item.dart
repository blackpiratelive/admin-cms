class TripItem {
  final String id;
  final String title;
  final String slug;
  final String? status;

  TripItem({
    required this.id,
    required this.title,
    required this.slug,
    this.status,
  });

  factory TripItem.fromJson(Map<String, dynamic> json) {
    return TripItem(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      status: json['status']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'slug': slug,
      'status': status,
    };
  }

  String get displayStatus {
    if (status == null || status!.isEmpty) return '';
    return status![0].toUpperCase() + status!.substring(1);
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TripItem && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
