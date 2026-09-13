import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/models/person_record.dart';
import '../core/theme/liquid_glass_theme.dart';
import 'liquid_glass_container.dart';

class PersonCard extends StatelessWidget {
  final PersonRecord person;
  final VoidCallback onTap;
  final VoidCallback? onToggleFavorite;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const PersonCard({
    super.key,
    required this.person,
    required this.onTap,
    this.onToggleFavorite,
    this.onEdit,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = LiquidGlassTheme.isDark(context);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: LiquidGlassContainer(
        borderRadius: LiquidGlassTheme.cardRadius,
        padding: const EdgeInsets.all(16),
        interactive: true,
        onTap: onTap,
        onLongPress: () {
          HapticFeedback.heavyImpact();
          _showActionSheet(context);
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Avatar, Name/Nickname, Favorite Star
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar
                if (person.hasAvatar)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: CachedNetworkImage(
                      imageUrl: person.avatarUrl!,
                      width: 44,
                      height: 44,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => _initialsAvatar(),
                    ),
                  )
                else
                  _initialsAvatar(),

                const SizedBox(width: 12),

                // Name & Subtitle
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              person.displayName,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.3,
                                color: CupertinoColors.label,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (person.nickname != null && person.nickname!.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Text(
                              '(${person.nickname})',
                              style: TextStyle(
                                fontSize: 13,
                                fontStyle: FontStyle.italic,
                                color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),

                      // Badges: Relationship + Visibility
                      Row(
                        children: [
                          // Relationship Pill
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(6),
                              color: const Color(0xFF8B5CF6).withValues(alpha: 0.16),
                              border: Border.all(
                                color: const Color(0xFF8B5CF6).withValues(alpha: 0.35),
                                width: 0.8,
                              ),
                            ),
                            child: Text(
                              person.relationshipType,
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF8B5CF6),
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),

                          // Visibility
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                person.visibility == 'public'
                                    ? CupertinoIcons.globe
                                    : person.visibility == 'unlisted'
                                        ? CupertinoIcons.eye_slash
                                        : CupertinoIcons.lock,
                                size: 10,
                                color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                              ),
                              const SizedBox(width: 3),
                              Text(
                                person.visibility,
                                style: TextStyle(
                                  fontSize: 10,
                                  color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Favorite Star
                CupertinoButton(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    onToggleFavorite?.call();
                  },
                  child: Icon(
                    person.favorite ? CupertinoIcons.star_fill : CupertinoIcons.star,
                    size: 19,
                    color: person.favorite ? const Color(0xFFF59E0B) : CupertinoColors.systemGrey,
                  ),
                ),
              ],
            ),

            // Important Dates Preview
            if (person.importantDates.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: person.importantDates.take(2).map((d) {
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: isDark ? const Color(0x28FFFFFF) : const Color(0x12000000),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(CupertinoIcons.calendar, size: 11, color: Color(0xFFEC4899)),
                        const SizedBox(width: 4),
                        Text(
                          '${d.title}: ${d.date}',
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                          ),
                        ),
                        if (d.daysRemaining <= 30) ...[
                          const SizedBox(width: 4),
                          Text(
                            '(${d.countdownBadge})',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFFEC4899),
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                }).toList(),
              ),
            ],

            // Interests Tag Chips
            if (person.interests.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: person.interests.take(4).map((interest) {
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      color: isDark ? const Color(0x22FFFFFF) : const Color(0x10000000),
                    ),
                    child: Text(
                      '#$interest',
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _initialsAvatar() {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          colors: [Color(0xFF8B5CF6), Color(0xFFEC4899)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        person.initials,
        style: const TextStyle(
          color: CupertinoColors.white,
          fontSize: 16,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  void _showActionSheet(BuildContext context) {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (BuildContext sheetContext) => CupertinoActionSheet(
        title: Text(person.displayName),
        message: Text(person.relationshipType),
        actions: <CupertinoActionSheetAction>[
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(sheetContext);
              onTap();
            },
            child: const Text('View Memory Hub'),
          ),
          if (onEdit != null)
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.pop(sheetContext);
                onEdit?.call();
              },
              child: const Text('Edit Profile'),
            ),
          if (onToggleFavorite != null)
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.pop(sheetContext);
                onToggleFavorite?.call();
              },
              child: Text(person.favorite ? 'Unmark Favorite' : 'Mark Favorite'),
            ),
          if (onDelete != null)
            CupertinoActionSheetAction(
              isDestructiveAction: true,
              onPressed: () {
                Navigator.pop(sheetContext);
                _confirmDelete(context);
              },
              child: const Text('Delete Contact'),
            ),
        ],
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.pop(sheetContext),
          child: const Text('Cancel'),
        ),
      ),
    );
  }

  void _confirmDelete(BuildContext context) {
    showCupertinoDialog<void>(
      context: context,
      builder: (BuildContext dialogContext) => CupertinoAlertDialog(
        title: const Text('Delete Contact'),
        content: Text('Are you sure you want to delete ${person.displayName}? This will unlink all photos, trips, and memories.'),
        actions: <CupertinoDialogAction>[
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () {
              Navigator.pop(dialogContext);
              onDelete?.call();
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
