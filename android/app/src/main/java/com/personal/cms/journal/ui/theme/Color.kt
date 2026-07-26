package com.personal.cms.journal.ui.theme

import androidx.compose.ui.graphics.Color

// Premium Indigo/Slate Base Colors
val Indigo50 = Color(0xFFEEF2FF)
val Indigo100 = Color(0xFFE0E7FF)
val Indigo200 = Color(0xFFC7D2FE)
val Indigo300 = Color(0xFFA5B4FC)
val Indigo400 = Color(0xFF818CF8)
val Indigo500 = Color(0xFF6366F1)
val Indigo600 = Color(0xFF4F46E5)
val Indigo700 = Color(0xFF4338CA)
val Indigo800 = Color(0xFF3730A3)
val Indigo900 = Color(0xFF312E81)

val Slate50 = Color(0xFFF8FAFC)
val Slate100 = Color(0xFFF1F5F9)
val Slate200 = Color(0xFFE2E8F0)
val Slate300 = Color(0xFFCBD5E1)
val Slate400 = Color(0xFF94A3B8)
val Slate500 = Color(0xFF64748B)
val Slate600 = Color(0xFF475569)
val Slate700 = Color(0xFF334155)
val Slate800 = Color(0xFF1E293B)
val Slate900 = Color(0xFF0F172A)

// Warm Accent Colors (Tertiary)
val Amber100 = Color(0xFFFEF3C7)
val Amber500 = Color(0xFFF59E0B)
val Amber800 = Color(0xFF92400E)

val Rose100 = Color(0xFFFFE4E6)
val Rose500 = Color(0xFFF43F5E)
val Rose800 = Color(0xFF9F1239)

val Emerald100 = Color(0xFFD1FAE5)
val Emerald500 = Color(0xFF10B981)
val Emerald800 = Color(0xFF065F46)

// Semantic Colors
val SuccessLight = Emerald500
val SuccessDark = Color(0xFF34D399)
val SuccessContainerLight = Emerald100
val SuccessContainerDark = Emerald800

val WarningLight = Amber500
val WarningDark = Color(0xFFFBBF24)
val WarningContainerLight = Amber100
val WarningContainerDark = Amber800

val ErrorLight = Color(0xFFB3261E)
val ErrorDark = Color(0xFFF2B8B5)
val ErrorContainerLight = Color(0xFFF9DEDC)
val ErrorContainerDark = Color(0xFF8C1D18)

// Gradient Ready Color Pairs
val GradientIndigoStart = Indigo500
val GradientIndigoEnd = Color(0xFF8B5CF6) // Violet

val GradientWarmStart = Amber500
val GradientWarmEnd = Rose500

val GradientCoolStart = Color(0xFF06B6D4) // Cyan
val GradientCoolEnd = Indigo500

// Mood Indicator Colors
val MoodAmazing = Color(0xFFFFD700)     // Gold/Yellow
val MoodHappy = Color(0xFFF472B6)       // Pink
val MoodGood = Emerald500               // Green
val MoodNeutral = Slate400              // Gray
val MoodReflective = Color(0xFFA855F7)  // Purple
val MoodEnergetic = Color(0xFFF97316)   // Orange
val MoodSad = Color(0xFF3B82F6)         // Blue
val MoodTired = Color(0xFF64748B)       // Slate
val MoodBad = Color(0xFFEF4444)         // Red
val MoodTerrible = Color(0xFF7F1D1D)    // Dark Red

// Light Theme Scheme Colors
val LightPrimary = Indigo600
val LightOnPrimary = Color.White
val LightPrimaryContainer = Indigo100
val LightOnPrimaryContainer = Indigo900
val LightInversePrimary = Indigo300

val LightSecondary = Color(0xFF8B5CF6) // Violet
val LightOnSecondary = Color.White
val LightSecondaryContainer = Color(0xFFEDE9FE)
val LightOnSecondaryContainer = Color(0xFF4C1D95)

val LightTertiary = Amber500
val LightOnTertiary = Color.White
val LightTertiaryContainer = Amber100
val LightOnTertiaryContainer = Amber800

val LightBackground = Slate50
val LightOnBackground = Slate900
val LightSurface = Color.White
val LightOnSurface = Slate900
val LightSurfaceVariant = Slate100
val LightOnSurfaceVariant = Slate600
val LightSurfaceTint = Indigo600
val LightInverseSurface = Slate800
val LightInverseOnSurface = Slate50

val LightOutline = Slate300
val LightOutlineVariant = Slate200
val LightScrim = Color.Black.copy(alpha = 0.32f)

// Dark Theme Scheme Colors
val DarkPrimary = Indigo300
val DarkOnPrimary = Indigo900
val DarkPrimaryContainer = Indigo700
val DarkOnPrimaryContainer = Indigo100
val DarkInversePrimary = Indigo600

val DarkSecondary = Color(0xFFA78BFA) // Light Violet
val DarkOnSecondary = Color(0xFF2E1065)
val DarkSecondaryContainer = Color(0xFF5B21B6)
val DarkOnSecondaryContainer = Color(0xFFEDE9FE)

val DarkTertiary = Amber500
val DarkOnTertiary = Amber800
val DarkTertiaryContainer = Color(0xFF78350F)
val DarkOnTertiaryContainer = Amber100

val DarkBackground = Slate900
val DarkOnBackground = Slate50
val DarkSurface = Slate800
val DarkOnSurface = Slate50
val DarkSurfaceVariant = Slate700
val DarkOnSurfaceVariant = Slate300
val DarkSurfaceTint = Indigo300
val DarkInverseSurface = Slate100
val DarkInverseOnSurface = Slate900

val DarkOutline = Slate600
val DarkOutlineVariant = Slate700
val DarkScrim = Color.Black.copy(alpha = 0.5f)
