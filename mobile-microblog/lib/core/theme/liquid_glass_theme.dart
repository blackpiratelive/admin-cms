import 'package:flutter/cupertino.dart';

/// Design tokens and material styles for Apple-inspired Liquid Glass UI.
class LiquidGlassTheme {
  // Optical Blur
  static const double defaultBlurSigma = 18.0;
  static const double subtleBlurSigma = 10.0;

  // Corner Radius
  static const double cardRadius = 18.0;
  static const double pillRadius = 24.0;
  static const double chipRadius = 12.0;

  /// Whether the current brightness is Dark
  static bool isDark(BuildContext context) {
    return CupertinoTheme.of(context).brightness == Brightness.dark;
  }

  /// Base glass translucent fill color
  static Color glassFill(BuildContext context, {double opacityMultiplier = 1.0}) {
    if (isDark(context)) {
      return Color.fromRGBO(24, 24, 30, (0.65 * opacityMultiplier).clamp(0.0, 1.0));
    } else {
      return Color.fromRGBO(255, 255, 255, (0.72 * opacityMultiplier).clamp(0.0, 1.0));
    }
  }

  /// Top-down specular fill gradient simulating surface curvature
  static Gradient glassSurfaceGradient(BuildContext context) {
    final dark = isDark(context);
    if (dark) {
      return const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0x35FFFFFF),
          Color(0x18FFFFFF),
          Color(0x0CFFFFFF),
        ],
        stops: [0.0, 0.4, 1.0],
      );
    } else {
      return const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xD9FFFFFF),
          Color(0xB3FFFFFF),
          Color(0x8CFFFFFF),
        ],
        stops: [0.0, 0.45, 1.0],
      );
    }
  }

  /// Directional specular border gradient (light catches top-left, fades to shadow bottom-right)
  static List<Color> specularBorderColors(BuildContext context) {
    final dark = isDark(context);
    if (dark) {
      return const [
        Color(0x52FFFFFF), // Top-left specular highlight
        Color(0x24FFFFFF), // Mid sheen
        Color(0x0DFFFFFF), // Bottom-right shadow rim
      ];
    } else {
      return const [
        Color(0xFFFFFFFF), // Crisp top-left specular reflection
        Color(0x99FFFFFF), // Soft fill rim
        Color(0x40FFFFFF), // Bottom reflection
      ];
    }
  }

  /// Ambient multi-tiered shadow stack
  static List<BoxShadow> glassShadows(BuildContext context, {double elevation = 1.0}) {
    final dark = isDark(context);
    if (dark) {
      return [
        BoxShadow(
          color: const Color(0x66000000),
          offset: Offset(0, 8 * elevation),
          blurRadius: 24 * elevation,
          spreadRadius: -2,
        ),
        BoxShadow(
          color: const Color(0x33000000),
          offset: Offset(0, 2 * elevation),
          blurRadius: 6 * elevation,
        ),
      ];
    } else {
      return [
        BoxShadow(
          color: const Color(0x14000000),
          offset: Offset(0, 10 * elevation),
          blurRadius: 28 * elevation,
          spreadRadius: -4,
        ),
        BoxShadow(
          color: const Color(0x0A000000),
          offset: Offset(0, 2 * elevation),
          blurRadius: 6 * elevation,
        ),
      ];
    }
  }

  /// Aurora Mesh Colors for the living canvas
  static List<Color> auroraPalette(BuildContext context) {
    final dark = isDark(context);
    if (dark) {
      return const [
        Color(0xFF3B82F6), // Sapphire
        Color(0xFF8B5CF6), // Royal Violet
        Color(0xFF06B6D4), // Cyan Glow
        Color(0xFF4F46E5), // Electric Indigo
      ];
    } else {
      return const [
        Color(0xFFBAE6FD), // Soft Sky Blue
        Color(0xFFDDD6FE), // Soft Lavender
        Color(0xFFFED7AA), // Peach Glow
        Color(0xFFA7F3D0), // Fresh Mint
      ];
    }
  }

  /// Glowing jewel LED effect for status indicator
  static BoxDecoration jewelLed({required bool isPublished}) {
    final baseColor = isPublished ? CupertinoColors.systemGreen : CupertinoColors.systemOrange;
    return BoxDecoration(
      shape: BoxShape.circle,
      color: baseColor,
      boxShadow: [
        BoxShadow(
          color: baseColor.withValues(alpha: 0.65),
          blurRadius: 6,
          spreadRadius: 1,
        ),
      ],
    );
  }
}
