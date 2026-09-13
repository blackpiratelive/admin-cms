import 'package:flutter/cupertino.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/models/upcoming_birthday_item.dart';
import '../core/theme/cupertino_theme.dart';

class UpcomingBirthdaysWidget extends StatelessWidget {
  final List<UpcomingBirthdayItem> items;
  final ValueChanged<UpcomingBirthdayItem>? onItemTap;

  const UpcomingBirthdaysWidget({
    super.key,
    required this.items,
    this.onItemTap,
  });

  static Color getCountdownColor(int days) {
    if (days == 0) return CupertinoColors.systemRed;
    if (days == 1) return CupertinoColors.systemOrange;
    if (days <= 7) return const Color(0xFFF59E0B);
    return CupertinoColors.systemGreen;
  }

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    final isDark = AppCupertinoTheme.isDark(context);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      decoration: BoxDecoration(
        color: AppCupertinoTheme.cardBackground.resolveFrom(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppCupertinoTheme.cardBorder.resolveFrom(context),
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: CupertinoColors.systemGrey5.resolveFrom(context).withValues(alpha: 0.3),
            offset: const Offset(0, 2),
            blurRadius: 8,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFEC4899).withValues(alpha: 0.15),
                ),
                child: const Icon(
                  CupertinoIcons.gift_fill,
                  size: 15,
                  color: Color(0xFFEC4899),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Upcoming Dates & Birthdays',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                  color: CupertinoColors.label,
                ),
              ),
              const Spacer(),
              Text(
                '${items.length} coming up',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Horizontal scrollable chips
          SizedBox(
            height: 64,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final item = items[index];
                return GestureDetector(
                  onTap: () => onItemTap?.call(item),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                      border: Border.all(
                        color: AppCupertinoTheme.cardBorder.resolveFrom(context),
                        width: 0.8,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Avatar
                        if (item.hasAvatar)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(16),
                            child: CachedNetworkImage(
                              imageUrl: item.avatarUrl!,
                              width: 34,
                              height: 34,
                              fit: BoxFit.cover,
                              errorWidget: (_, _, _) => _initialsAvatar(item),
                            ),
                          )
                        else
                          _initialsAvatar(item),

                        const SizedBox(width: 10),

                        // Info
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              item.displayName,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: CupertinoColors.label,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Clean indicator dot
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: getCountdownColor(item.daysRemaining),
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  '${item.title} • ${item.countdownBadge}',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: item.daysRemaining <= 1 ? FontWeight.w700 : FontWeight.w500,
                                    color: item.daysRemaining == 0
                                        ? CupertinoColors.systemRed
                                        : item.daysRemaining == 1
                                            ? CupertinoColors.systemOrange
                                            : (isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _initialsAvatar(UpcomingBirthdayItem item) {
    return Container(
      width: 34,
      height: 34,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [Color(0xFF8B5CF6), Color(0xFFEC4899)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        item.initials,
        style: const TextStyle(
          color: CupertinoColors.white,
          fontSize: 12,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
