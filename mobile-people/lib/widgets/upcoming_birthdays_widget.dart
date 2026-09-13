import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/models/upcoming_birthday_item.dart';
import '../core/theme/cupertino_theme.dart';

class UpcomingBirthdaysWidget extends StatelessWidget {
  final List<UpcomingBirthdayItem> items;
  final ValueChanged<UpcomingBirthdayItem>? onItemTap;
  final VoidCallback? onSeeAll;

  const UpcomingBirthdaysWidget({
    super.key,
    required this.items,
    this.onItemTap,
    this.onSeeAll,
  });

  static const List<String> _monthAbbrs = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
  ];

  static const List<String> _monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  static ({String monthAbbr, String monthName, String day}) parseDate(String dateStr) {
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
      return (
        monthAbbr: _monthAbbrs[m - 1],
        monthName: _monthNames[m - 1],
        day: d.toString(),
      );
    } catch (_) {
      return (monthAbbr: 'DATE', monthName: '', day: '');
    }
  }

  static Color getCountdownColor(int days) {
    if (days == 0) return CupertinoColors.systemRed;
    if (days == 1) return CupertinoColors.systemOrange;
    if (days <= 7) return const Color(0xFFF59E0B);
    return CupertinoColors.systemGreen;
  }

  void _handleSeeAll(BuildContext context) {
    HapticFeedback.lightImpact();
    if (onSeeAll != null) {
      onSeeAll!();
      return;
    }

    showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => CupertinoActionSheet(
        title: const Text('All Upcoming Dates & Birthdays'),
        message: Text('${items.length} upcoming moments in your circle'),
        actions: items.map((item) {
          final dateInfo = parseDate(item.dateStr);
          final subtitle = dateInfo.monthName.isNotEmpty
              ? '${item.title} · ${dateInfo.monthName} ${dateInfo.day} (${item.countdownBadge})'
              : '${item.title} (${item.countdownBadge})';
          final labelColor = AppCupertinoTheme.label(context);
          final secondaryColor = AppCupertinoTheme.secondary(context);
          return CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(ctx);
              onItemTap?.call(item);
            },
            child: Row(
              children: [
                const SizedBox(width: 8),
                _buildAvatar(context, item, size: 32),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        item.displayName,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: labelColor,
                        ),
                      ),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 13,
                          color: secondaryColor,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    item.daysRemaining == 0
                        ? 'Today!'
                        : item.daysRemaining == 1
                            ? 'Tomorrow'
                            : 'In ${item.daysRemaining} days',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppCupertinoTheme.brandAccent,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
            ),
          );
        }).toList(),
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Close'),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    // Show up to 3 upcoming moments on homepage
    final displayedItems = items.take(3).toList();

    final labelColor = AppCupertinoTheme.label(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Heading: "Coming up" + "See all >"
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                'Coming up',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.5,
                  color: labelColor,
                ),
              ),
              CupertinoButton(
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                onPressed: () => _handleSeeAll(context),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'See all',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppCupertinoTheme.brandAccent,
                      ),
                    ),
                    SizedBox(width: 2),
                    Icon(
                      CupertinoIcons.chevron_right,
                      size: 13,
                      color: AppCupertinoTheme.brandAccent,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Vertically stacked compact cards
          ListView.separated(
            padding: EdgeInsets.zero,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: displayedItems.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final item = displayedItems[index];
              return _buildCompactCard(context, item);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildCompactCard(BuildContext context, UpcomingBirthdayItem item) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);
    final dateInfo = parseDate(item.dateStr);
    final subtitle = dateInfo.monthName.isNotEmpty
        ? '${item.title} · ${dateInfo.monthName} ${dateInfo.day}'
        : item.title;

    final countdownText = item.daysRemaining == 0
        ? 'Today!'
        : item.daysRemaining == 1
            ? 'Tomorrow'
            : 'In ${item.daysRemaining} days';

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        HapticFeedback.lightImpact();
        onItemTap?.call(item);
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppCupertinoTheme.cardBackground.resolveFrom(context),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: AppCupertinoTheme.cardBorder.resolveFrom(context),
            width: 0.6,
          ),
          boxShadow: [
            BoxShadow(
              color: CupertinoColors.systemGrey5.resolveFrom(context).withValues(alpha: 0.25),
              offset: const Offset(0, 2),
              blurRadius: 6,
            ),
          ],
        ),
        child: Row(
          children: [
            // Left Date Badge Box (e.g. SEP 21)
            Container(
              width: 46,
              height: 48,
              decoration: BoxDecoration(
                color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    dateInfo.monthAbbr,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.4,
                      color: secondaryColor,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    dateInfo.day,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      color: labelColor,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),

            // Avatar
            _buildAvatar(context, item, size: 38),

            const SizedBox(width: 12),

            // Name + Subtitle
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    item.displayName,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.3,
                      color: labelColor,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                      color: secondaryColor,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),

            const SizedBox(width: 8),

            // Trailing Pill: 🎁 In X days
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    CupertinoIcons.gift_fill,
                    size: 12,
                    color: AppCupertinoTheme.brandAccent,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    countdownText,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppCupertinoTheme.brandAccent,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _buildAvatar(BuildContext context, UpcomingBirthdayItem item, {double size = 38}) {
    if (item.hasAvatar) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(size / 2),
        child: CachedNetworkImage(
          imageUrl: item.avatarUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorWidget: (_, _, _) => _buildInitials(item, size),
        ),
      );
    }
    return _buildInitials(item, size);
  }

  static Widget _buildInitials(UpcomingBirthdayItem item, double size) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: AppCupertinoTheme.brandGradient,
      ),
      alignment: Alignment.center,
      child: Text(
        item.initials,
        style: TextStyle(
          color: CupertinoColors.white,
          fontSize: size * 0.4,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
