import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/models/person_record.dart';
import '../core/models/important_date.dart';
import '../core/theme/cupertino_theme.dart';

class PersonCard extends StatelessWidget {
  final PersonRecord person;
  final VoidCallback onTap;
  final VoidCallback? onToggleFavorite;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final bool showDivider;

  const PersonCard({
    super.key,
    required this.person,
    required this.onTap,
    this.onToggleFavorite,
    this.onEdit,
    this.onDelete,
    this.showDivider = true,
  });

  static const List<String> _monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  static ({String monthName, String day}) _formatDate(String dateStr) {
    try {
      final parts = dateStr.split('-');
      int m = 1;
      int d = 1;
      if (parts.length == 3) {
        m = int.tryParse(parts[1]) ?? 1;
        d = int.tryParse(parts[2]) ?? 1;
      } else if (parts.length == 2) {
        m = int.tryParse(parts[0]) ?? 1;
        d = int.tryParse(parts[1]) ?? 1;
      }
      m = m.clamp(1, 12);
      return (monthName: _monthNames[m - 1], day: d.toString());
    } catch (_) {
      return (monthName: '', day: '');
    }
  }

  ImportantDate? get _primaryBirthday {
    if (person.importantDates.isEmpty) return null;
    try {
      return person.importantDates.firstWhere(
        (d) => d.title.toLowerCase().contains('birth'),
        orElse: () => person.importantDates.first,
      );
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = AppCupertinoTheme.isDark(context);
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);
    final birthday = _primaryBirthday;
    final birthdayDateInfo = birthday != null ? _formatDate(birthday.date) : null;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            HapticFeedback.lightImpact();
            onTap();
          },
          onLongPress: () {
            HapticFeedback.heavyImpact();
            _showActionSheet(context);
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Initials or Image Avatar (Restrained 44x44 circle)
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

                const SizedBox(width: 14),

                // Name & Metadata Column
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Name Line
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              person.displayName,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                letterSpacing: -0.3,
                                color: labelColor,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (person.nickname != null && person.nickname!.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                '(${person.nickname})',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontStyle: FontStyle.italic,
                                  color: secondaryColor,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),

                      // Relationship · Privacy Line (Plain text with subtle icon, no large pills!)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            person.relationshipType,
                            style: TextStyle(
                              fontSize: 13,
                              color: secondaryColor,
                            ),
                          ),
                          Text(
                            ' · ',
                            style: TextStyle(
                              fontSize: 13,
                              color: secondaryColor,
                            ),
                          ),
                          Icon(
                            person.visibility == 'public'
                                ? CupertinoIcons.globe
                                : person.visibility == 'unlisted'
                                    ? CupertinoIcons.eye_slash
                                    : CupertinoIcons.lock,
                            size: 11,
                            color: secondaryColor,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            person.visibility == 'public'
                                ? 'Public'
                                : person.visibility == 'unlisted'
                                    ? 'Unlisted'
                                    : 'Private',
                            style: TextStyle(
                              fontSize: 13,
                              color: secondaryColor,
                            ),
                          ),
                        ],
                      ),

                      // Birthday Line (if present)
                      if (birthday != null && birthdayDateInfo != null && birthdayDateInfo.monthName.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              CupertinoIcons.calendar,
                              size: 12,
                              color: Color(0xFFEC4899),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${birthday.title} · ${birthdayDateInfo.monthName} ${birthdayDateInfo.day}',
                              style: TextStyle(
                                fontSize: 12,
                                color: secondaryColor,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(width: 8),

                // Trailing Favorite Star
                CupertinoButton(
                  padding: const EdgeInsets.all(8),
                  minimumSize: Size.zero,
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    onToggleFavorite?.call();
                  },
                  child: Icon(
                    person.favorite ? CupertinoIcons.star_fill : CupertinoIcons.star,
                    size: 20,
                    color: person.favorite
                        ? const Color(0xFFF59E0B)
                        : (isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey3),
                  ),
                ),
              ],
            ),
          ),
        ),

        // Subtle Inset Divider
        if (showDivider)
          Padding(
            padding: const EdgeInsets.only(left: 74),
            child: Container(
              height: 0.5,
              color: AppCupertinoTheme.cardBorder.resolveFrom(context),
            ),
          ),
      ],
    );
  }

  Widget _initialsAvatar() {
    return Container(
      width: 44,
      height: 44,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: AppCupertinoTheme.brandGradient,
      ),
      alignment: Alignment.center,
      child: Text(
        person.initials,
        style: const TextStyle(
          color: CupertinoColors.white,
          fontSize: 16,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  void _showActionSheet(BuildContext context) {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (BuildContext sheetContext) => CupertinoActionSheet(
        title: Text(person.displayName),
        message: Text('${person.relationshipType} • ${person.visibility}'),
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
