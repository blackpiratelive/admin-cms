import 'package:flutter/cupertino.dart';

class PersonTimelineItem {
  final String id;
  final String type; // 'activity', 'date', 'trip', 'photo', 'microblog'
  final String date;
  final String title;
  final String? description;
  final Map<String, dynamic>? metadata;

  const PersonTimelineItem({
    required this.id,
    required this.type,
    required this.date,
    required this.title,
    this.description,
    this.metadata,
  });

  factory PersonTimelineItem.fromJson(Map<String, dynamic> json) {
    return PersonTimelineItem(
      id: json['id'] as String? ?? 'timeline_${DateTime.now().millisecondsSinceEpoch}',
      type: json['type'] as String? ?? 'activity',
      date: json['date'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  String? get thumbnailUrl => metadata?['thumbnailUrl'] as String? ?? metadata?['mediumUrl'] as String?;

  Color get nodeColor {
    switch (type) {
      case 'date':
        return const Color(0xFFF59E0B); // Amber
      case 'trip':
        return const Color(0xFF8B5CF6); // Purple
      case 'photo':
        return const Color(0xFF06B6D4); // Cyan
      case 'microblog':
        return const Color(0xFF3B82F6); // Blue
      default:
        return CupertinoColors.systemGrey;
    }
  }

  IconData get iconData {
    switch (type) {
      case 'date':
        return CupertinoIcons.calendar;
      case 'trip':
        return CupertinoIcons.airplane;
      case 'photo':
        return CupertinoIcons.photo;
      case 'microblog':
        return CupertinoIcons.chat_bubble_text;
      default:
        return CupertinoIcons.time;
    }
  }
}
