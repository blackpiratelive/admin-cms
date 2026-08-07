import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/app_theme.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final String activeThemeKey;

  const StatusBadge({
    super.key,
    required this.status,
    required this.activeThemeKey,
  });

  IconData get _icon {
    switch (status.toLowerCase()) {
      case 'published':
        return LucideIcons.globe;
      case 'scheduled':
        return LucideIcons.clock;
      case 'archived':
        return LucideIcons.archive;
      case 'draft':
      default:
        return LucideIcons.fileEdit;
    }
  }

  Color _color(CmsThemeColors colors) {
    switch (status.toLowerCase()) {
      case 'published':
        return colors.statusPublished;
      case 'scheduled':
        return colors.statusScheduled;
      case 'archived':
        return colors.statusArchived;
      case 'draft':
      default:
        return colors.statusDraft;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppTheme.colorsForTheme(activeThemeKey);
    final statusColor = _color(colors);
    final label = status.isEmpty ? 'Draft' : status[0].toUpperCase() + status.substring(1);

    return Tooltip(
      message: label,
      child: Container(
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          color: statusColor.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: statusColor.withValues(alpha: 0.3)),
        ),
        child: Icon(_icon, size: 15, color: statusColor),
      ),
    );
  }
}
