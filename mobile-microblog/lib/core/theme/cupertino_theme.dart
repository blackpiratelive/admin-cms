import 'package:flutter/cupertino.dart';

class AppCupertinoTheme {
  // Brand / Tint Colors
  static const Color primaryBlue = CupertinoColors.systemBlue;
  static const Color accentOrange = CupertinoColors.systemOrange;
  static const Color statusGreen = CupertinoColors.systemGreen;
  static const Color statusAmber = CupertinoColors.systemOrange;
  static const Color statusRed = CupertinoColors.systemRed;

  // Cupertino Theme Factory
  static CupertinoThemeData get dynamicTheme {
    return const CupertinoThemeData(
      primaryColor: primaryBlue,
      applyThemeToAll: true,
      scaffoldBackgroundColor: CupertinoColors.systemGroupedBackground,
      barBackgroundColor: CupertinoDynamicColor.withBrightness(
        color: Color(0xCCF8F8F8),
        darkColor: Color(0xCC1A1A1A),
      ),
      textTheme: CupertinoTextThemeData(
        primaryColor: CupertinoColors.label,
        navTitleTextStyle: TextStyle(
          inherit: false,
          fontSize: 17.0,
          letterSpacing: -0.5,
          fontWeight: FontWeight.w600,
          color: CupertinoColors.label,
        ),
        navLargeTitleTextStyle: TextStyle(
          inherit: false,
          fontSize: 34.0,
          letterSpacing: -1.0,
          fontWeight: FontWeight.bold,
          color: CupertinoColors.label,
        ),
        textStyle: TextStyle(
          inherit: false,
          fontSize: 16.0,
          letterSpacing: -0.3,
          color: CupertinoColors.label,
        ),
      ),
    );
  }

  // Dynamic Card Background
  static const CupertinoDynamicColor cardBackground =
      CupertinoDynamicColor.withBrightness(
    color: CupertinoColors.white,
    darkColor: Color(0xFF1C1C1E),
  );

  // Dynamic Card Border / Divider
  static const CupertinoDynamicColor cardBorder =
      CupertinoDynamicColor.withBrightness(
    color: Color(0x18000000),
    darkColor: Color(0x28FFFFFF),
  );

  // Dynamic Subtle Fill (for Tag pills, counters, etc.)
  static const CupertinoDynamicColor subtleFill =
      CupertinoDynamicColor.withBrightness(
    color: Color(0xFFE5E5EA),
    darkColor: Color(0xFF2C2C2E),
  );

  // Dynamic Secondary Text
  static const CupertinoDynamicColor secondaryLabel =
      CupertinoColors.secondaryLabel;
}
