class ImportantDate {
  final String id;
  final String title;
  final String date; // YYYY-MM-DD or MM-DD
  final bool reminderEnabled;
  final String? notes;

  const ImportantDate({
    required this.id,
    required this.title,
    required this.date,
    this.reminderEnabled = false,
    this.notes,
  });

  factory ImportantDate.fromJson(Map<String, dynamic> json) {
    return ImportantDate(
      id: json['id'] as String? ?? 'date_${DateTime.now().millisecondsSinceEpoch}',
      title: json['title'] as String? ?? 'Important Date',
      date: json['date'] as String? ?? '',
      reminderEnabled: json['reminderEnabled'] == true || json['reminderEnabled'] == 1,
      notes: json['notes'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'date': date,
      'reminderEnabled': reminderEnabled,
      if (notes != null) 'notes': notes,
    };
  }

  int get daysRemaining {
    if (date.isEmpty) return 999;
    try {
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final parts = date.split('-');

      int month = 0;
      int day = 0;
      if (parts.length == 3) {
        month = int.parse(parts[1]);
        day = int.parse(parts[2]);
      } else if (parts.length == 2) {
        month = int.parse(parts[0]);
        day = int.parse(parts[1]);
      } else {
        return 999;
      }

      var nextOccurrence = DateTime(now.year, month, day);
      if (nextOccurrence.isBefore(today)) {
        nextOccurrence = DateTime(now.year + 1, month, day);
      }

      return nextOccurrence.difference(today).inDays;
    } catch (_) {
      return 999;
    }
  }

  String get countdownBadge {
    final diff = daysRemaining;
    if (diff == 0) return 'Today!';
    if (diff == 1) return 'Tomorrow';
    return 'in $diff days';
  }

  ImportantDate copyWith({
    String? id,
    String? title,
    String? date,
    bool? reminderEnabled,
    String? notes,
  }) {
    return ImportantDate(
      id: id ?? this.id,
      title: title ?? this.title,
      date: date ?? this.date,
      reminderEnabled: reminderEnabled ?? this.reminderEnabled,
      notes: notes ?? this.notes,
    );
  }
}
