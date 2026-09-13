class UpcomingBirthdayItem {
  final String personId;
  final String displayName;
  final String slug;
  final String? avatarUrl;
  final String? relationshipType;
  final String title;
  final String dateStr;
  final int daysRemaining;

  const UpcomingBirthdayItem({
    required this.personId,
    required this.displayName,
    required this.slug,
    this.avatarUrl,
    this.relationshipType,
    required this.title,
    required this.dateStr,
    required this.daysRemaining,
  });

  factory UpcomingBirthdayItem.fromJson(Map<String, dynamic> json) {
    return UpcomingBirthdayItem(
      personId: json['personId'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      relationshipType: json['relationshipType'] as String?,
      title: json['title'] as String? ?? 'Birthday',
      dateStr: json['dateStr'] as String? ?? '',
      daysRemaining: json['daysRemaining'] is int
          ? json['daysRemaining'] as int
          : int.tryParse(json['daysRemaining'].toString()) ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'personId': personId,
      'displayName': displayName,
      'slug': slug,
      if (avatarUrl != null) 'avatarUrl': avatarUrl,
      if (relationshipType != null) 'relationshipType': relationshipType,
      'title': title,
      'dateStr': dateStr,
      'daysRemaining': daysRemaining,
    };
  }

  String get countdownBadge {
    if (daysRemaining == 0) return 'Today!';
    if (daysRemaining == 1) return 'Tomorrow';
    return 'in $daysRemaining days';
  }

  String get initials {
    if (displayName.trim().isEmpty) return '?';
    final parts = displayName.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return displayName.trim().substring(0, 1).toUpperCase();
  }

  bool get hasAvatar => avatarUrl != null && avatarUrl!.trim().isNotEmpty;
}
