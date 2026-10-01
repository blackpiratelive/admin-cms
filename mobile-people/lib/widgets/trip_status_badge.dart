import 'package:flutter/cupertino.dart';

/// Small status pill shared by trip cards, featured hero, and detail header.
class TripStatusBadge extends StatelessWidget {
  final String status;
  final bool compact;

  const TripStatusBadge({super.key, required this.status, this.compact = false});

  static ({Color color, String label, IconData icon}) styleFor(String status) {
    switch (status) {
      case 'ongoing':
        return (color: CupertinoColors.systemGreen, label: 'Ongoing', icon: CupertinoIcons.location_fill);
      case 'completed':
        return (color: CupertinoColors.systemIndigo, label: 'Completed', icon: CupertinoIcons.checkmark_seal_fill);
      case 'cancelled':
        return (color: CupertinoColors.systemRed, label: 'Cancelled', icon: CupertinoIcons.xmark_circle_fill);
      case 'planned':
      default:
        return (color: CupertinoColors.systemBlue, label: 'Planned', icon: CupertinoIcons.calendar);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = styleFor(status);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: compact ? 7 : 9, vertical: compact ? 3 : 4),
      decoration: BoxDecoration(
        color: s.color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: s.color.withValues(alpha: 0.4), width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(s.icon, size: compact ? 10 : 12, color: s.color),
          const SizedBox(width: 4),
          Text(
            s.label,
            style: TextStyle(
              fontSize: compact ? 11 : 12,
              fontWeight: FontWeight.w600,
              color: s.color,
            ),
          ),
        ],
      ),
    );
  }
}

/// Deterministic fallback cover gradient when a trip has no cover photo.
LinearGradient coverGradientFor(String theme) {
  switch (theme) {
    case 'two':
      return const LinearGradient(
        colors: [Color(0xFF11998E), Color(0xFF38EF7D)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
    case 'three':
      return const LinearGradient(
        colors: [Color(0xFFFC5C7D), Color(0xFF6A82FB)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
    case 'four':
      return const LinearGradient(
        colors: [Color(0xFFF7971E), Color(0xFFFFD200)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
    case 'one':
    default:
      return const LinearGradient(
        colors: [Color(0xFF2193B0), Color(0xFF6DD5ED)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
  }
}
