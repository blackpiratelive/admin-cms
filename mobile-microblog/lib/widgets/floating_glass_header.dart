import 'package:flutter/cupertino.dart';
import '../core/theme/liquid_glass_theme.dart';
import 'liquid_glass_container.dart';

/// A modern floating frosted glass island navigation header.
/// Hovering over the content with rounded pill geometry, specular rims,
/// settings access, total post count capsule, and new post action.
class FloatingGlassHeader extends StatelessWidget {
  final int totalCount;
  final VoidCallback onOpenSettings;
  final VoidCallback onOpenComposer;
  final bool enableBlur;

  const FloatingGlassHeader({
    super.key,
    required this.totalCount,
    required this.onOpenSettings,
    required this.onOpenComposer,
    this.enableBlur = true,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = LiquidGlassTheme.isDark(context);

    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: LiquidGlassContainer(
          borderRadius: 26,
          blurSigma: 20,
          enableBlur: enableBlur,
          elevation: 1.2,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Left: Settings Button
              CupertinoButton(
                padding: const EdgeInsets.all(8),
                minimumSize: const Size(36, 36),
                onPressed: onOpenSettings,
                child: Icon(
                  CupertinoIcons.gear_alt_fill,
                  size: 20,
                  color: isDark
                      ? CupertinoColors.white.withValues(alpha: 0.85)
                      : CupertinoColors.darkBackgroundGray.withValues(alpha: 0.85),
                ),
              ),

              // Center: App Title & Dynamic Count Badge
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Microblog',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.4,
                      color: isDark ? CupertinoColors.white : CupertinoColors.black,
                    ),
                  ),
                  if (totalCount > 0) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: isDark
                            ? CupertinoColors.systemBlue.withValues(alpha: 0.25)
                            : CupertinoColors.systemBlue.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: CupertinoColors.systemBlue.withValues(alpha: 0.4),
                          width: 0.8,
                        ),
                      ),
                      child: Text(
                        '$totalCount',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: CupertinoColors.systemBlue,
                        ),
                      ),
                    ),
                  ],
                ],
              ),

              // Right: Compose / Add Button
              CupertinoButton(
                padding: const EdgeInsets.all(8),
                minimumSize: const Size(36, 36),
                onPressed: onOpenComposer,
                child: Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFF38BDF8), // Bright Sky
                        Color(0xFF2563EB), // Vibrant Blue
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF2563EB).withValues(alpha: 0.45),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(
                      CupertinoIcons.add,
                      size: 18,
                      color: CupertinoColors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
