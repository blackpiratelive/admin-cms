import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/theme/liquid_glass_theme.dart';
import 'liquid_glass_container.dart';

/// A floating frosted glass island header that hovers over the top of the feed.
class FloatingGlassHeader extends StatelessWidget {
  final String title;
  final int count;
  final VoidCallback? onSettingsTap;
  final VoidCallback? onAddTap;
  final VoidCallback? onFilterTap;
  final bool hasActiveFilters;
  final int pendingSyncCount;

  const FloatingGlassHeader({
    super.key,
    required this.title,
    required this.count,
    this.onSettingsTap,
    this.onAddTap,
    this.onFilterTap,
    this.hasActiveFilters = false,
    this.pendingSyncCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = LiquidGlassTheme.isDark(context);

    return LiquidGlassContainer(
      borderRadius: 26.0,
      elevation: 1.5,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Left: Settings button
          CupertinoButton(
            padding: EdgeInsets.zero,
            minimumSize: Size.zero,
            onPressed: () {
              HapticFeedback.lightImpact();
              onSettingsTap?.call();
            },
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDark ? const Color(0x33FFFFFF) : const Color(0x22000000),
              ),
              child: const Icon(
                CupertinoIcons.gear,
                size: 19,
                color: CupertinoColors.label,
              ),
            ),
          ),

          // Center: Title + live count badge
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.4,
                  color: CupertinoColors.label,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: isDark ? const Color(0x40FFFFFF) : const Color(0x25000000),
                ),
                child: Text(
                  count.toString(),
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: CupertinoColors.label,
                  ),
                ),
              ),
              if (pendingSyncCount > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: CupertinoColors.systemOrange.withValues(alpha: 0.8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(CupertinoIcons.cloud_upload, size: 11, color: CupertinoColors.white),
                      const SizedBox(width: 3),
                      Text(
                        pendingSyncCount.toString(),
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: CupertinoColors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),

          // Right: Filter toggle & Add button
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (onFilterTap != null) ...[
                CupertinoButton(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    onFilterTap?.call();
                  },
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: hasActiveFilters
                          ? const Color(0xFF8B5CF6).withValues(alpha: 0.25)
                          : (isDark ? const Color(0x33FFFFFF) : const Color(0x22000000)),
                      border: hasActiveFilters
                          ? Border.all(color: const Color(0xFF8B5CF6), width: 1.2)
                          : null,
                    ),
                    child: Icon(
                      CupertinoIcons.slider_horizontal_3,
                      size: 17,
                      color: hasActiveFilters ? const Color(0xFF8B5CF6) : CupertinoColors.label,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              CupertinoButton(
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                onPressed: () {
                  HapticFeedback.mediumImpact();
                  onAddTap?.call();
                },
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      colors: [Color(0xFF8B5CF6), Color(0xFFEC4899)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF8B5CF6).withValues(alpha: 0.45),
                        blurRadius: 10,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Icon(
                    CupertinoIcons.add,
                    size: 20,
                    color: CupertinoColors.white,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
