import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class CmsThemeColors {
  final Color primary;
  final Color headerBg;
  final Color headerText;
  final Color bodyBg;
  final Color cardBg;
  final Color cardBorder;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color inputBg;
  final Color inputBorder;
  final Color statusPublished;
  final Color statusDraft;
  final Color statusScheduled;
  final Color statusArchived;
  final Color danger;

  const CmsThemeColors({
    required this.primary,
    required this.headerBg,
    required this.headerText,
    required this.bodyBg,
    required this.cardBg,
    required this.cardBorder,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.inputBg,
    required this.inputBorder,
    required this.statusPublished,
    required this.statusDraft,
    required this.statusScheduled,
    required this.statusArchived,
    required this.danger,
  });

  static const hnOrange = CmsThemeColors(
    primary: Color(0xFFFF6600),
    headerBg: Color(0xFFFF6600),
    headerText: Colors.white,
    bodyBg: Color(0xFFF5F5F3),
    cardBg: Colors.white,
    cardBorder: Color(0xFFE2E2E0),
    textPrimary: Color(0xFF1A1A1A),
    textSecondary: Color(0xFF4A4A4A),
    textMuted: Color(0xFF707070),
    inputBg: Colors.white,
    inputBorder: Color(0xFFCCCCCC),
    statusPublished: Color(0xFF16A34A),
    statusDraft: Color(0xFFEAB308),
    statusScheduled: Color(0xFF2563EB),
    statusArchived: Color(0xFF6B7280),
    danger: Color(0xFFDC2626),
  );

  static const darkMode = CmsThemeColors(
    primary: Color(0xFFFF6600),
    headerBg: Color(0xFF18181B),
    headerText: Color(0xFFFAFAFA),
    bodyBg: Color(0xFF09090B),
    cardBg: Color(0xFF121215),
    cardBorder: Color(0xFF27272A),
    textPrimary: Color(0xFFFAFAFA),
    textSecondary: Color(0xFFA1A1AA),
    textMuted: Color(0xFF71717A),
    inputBg: Color(0xFF1C1C1E),
    inputBorder: Color(0xFF3F3F46),
    statusPublished: Color(0xFF22C55E),
    statusDraft: Color(0xFFFACC15),
    statusScheduled: Color(0xFF3B82F6),
    statusArchived: Color(0xFF9CA3AF),
    danger: Color(0xFFEF4444),
  );

  static const monoMode = CmsThemeColors(
    primary: Color(0xFFE4E4E7),
    headerBg: Color(0xFF18181B),
    headerText: Color(0xFFFFFFFF),
    bodyBg: Color(0xFF09090B),
    cardBg: Color(0xFF18181B),
    cardBorder: Color(0xFF27272A),
    textPrimary: Color(0xFFFFFFFF),
    textSecondary: Color(0xFFA1A1AA),
    textMuted: Color(0xFF71717A),
    inputBg: Color(0xFF27272A),
    inputBorder: Color(0xFF52525B),
    statusPublished: Color(0xFF4ADE80),
    statusDraft: Color(0xFFFDE047),
    statusScheduled: Color(0xFF60A5FA),
    statusArchived: Color(0xFF9CA3AF),
    danger: Color(0xFFF87171),
  );

  static const tealMode = CmsThemeColors(
    primary: Color(0xFF0D9488),
    headerBg: Color(0xFF0F172A),
    headerText: Color(0xFF2DD4BF),
    bodyBg: Color(0xFF020617),
    cardBg: Color(0xFF0F172A),
    cardBorder: Color(0xFF1E293B),
    textPrimary: Color(0xFFF8FAFC),
    textSecondary: Color(0xFF94A3B8),
    textMuted: Color(0xFF64748B),
    inputBg: Color(0xFF1E293B),
    inputBorder: Color(0xFF334155),
    statusPublished: Color(0xFF10B981),
    statusDraft: Color(0xFFF59E0B),
    statusScheduled: Color(0xFF06B6D4),
    statusArchived: Color(0xFF64748B),
    danger: Color(0xFFF43F5E),
  );
}

class AppTheme {
  static CmsThemeColors colorsForTheme(String themeKey) {
    switch (themeKey) {
      case 'dark':
        return CmsThemeColors.darkMode;
      case 'mono':
        return CmsThemeColors.monoMode;
      case 'teal':
        return CmsThemeColors.tealMode;
      case 'hn':
      default:
        return CmsThemeColors.hnOrange;
    }
  }

  static ThemeData buildTheme(String themeKey) {
    final colors = colorsForTheme(themeKey);
    final isDark = themeKey != 'hn';

    return ThemeData(
      useMaterial3: true,
      brightness: isDark ? Brightness.dark : Brightness.light,
      scaffoldBackgroundColor: colors.bodyBg,
      primaryColor: colors.primary,
      colorScheme: ColorScheme(
        brightness: isDark ? Brightness.dark : Brightness.light,
        primary: colors.primary,
        onPrimary: Colors.white,
        secondary: colors.primary,
        onSecondary: Colors.white,
        error: colors.danger,
        onError: Colors.white,
        surface: colors.cardBg,
        onSurface: colors.textPrimary,
      ),
      textTheme: TextTheme(
        headlineLarge: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.bold, color: colors.textPrimary),
        headlineMedium: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w700, color: colors.textPrimary),
        titleLarge: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: colors.textPrimary),
        titleMedium: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: colors.textPrimary),
        bodyLarge: GoogleFonts.inter(fontSize: 14, color: colors.textPrimary),
        bodyMedium: GoogleFonts.inter(fontSize: 13, color: colors.textSecondary),
        bodySmall: GoogleFonts.inter(fontSize: 12, color: colors.textMuted),
        labelLarge: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textPrimary),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.inputBg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: colors.inputBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: colors.inputBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: colors.primary, width: 1.5),
        ),
      ),
      cardTheme: CardThemeData(
        color: colors.cardBg,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: colors.cardBorder),
        ),
      ),
    );
  }
}
