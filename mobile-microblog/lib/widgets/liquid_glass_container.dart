import 'dart:ui';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/theme/liquid_glass_theme.dart';

/// A high-performance Apple Liquid Glass container with:
/// - Isolated RepaintBoundary for smooth 60/120fps scrolling
/// - Configurable optical BackdropFilter blur
/// - Directional specular highlight gradient stroke
/// - Dynamic Light/Dark translucent wash
/// - Soft ambient multi-tiered drop shadows
/// - Optional springy scale bounce micro-interaction
class LiquidGlassContainer extends StatefulWidget {
  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double blurSigma;
  final bool enableBlur;
  final bool interactive;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double elevation;
  final Color? surfaceColor;
  final Gradient? surfaceGradient;
  final bool hasBorder;

  const LiquidGlassContainer({
    super.key,
    required this.child,
    this.borderRadius = LiquidGlassTheme.cardRadius,
    this.padding,
    this.margin,
    this.blurSigma = LiquidGlassTheme.defaultBlurSigma,
    this.enableBlur = true,
    this.interactive = false,
    this.onTap,
    this.onLongPress,
    this.elevation = 1.0,
    this.surfaceColor,
    this.surfaceGradient,
    this.hasBorder = true,
  });

  @override
  State<LiquidGlassContainer> createState() => _LiquidGlassContainerState();
}

class _LiquidGlassContainerState extends State<LiquidGlassContainer> {
  bool _isPressed = false;

  void _handleTapDown(TapDownDetails _) {
    if (widget.interactive || widget.onTap != null) {
      setState(() => _isPressed = true);
    }
  }

  void _handleTapUp(TapUpDetails _) {
    if (_isPressed) {
      setState(() => _isPressed = false);
    }
  }

  void _handleTapCancel() {
    if (_isPressed) {
      setState(() => _isPressed = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = LiquidGlassTheme.isDark(context);
    final rrectRadius = Radius.circular(widget.borderRadius);
    final rrect = BorderRadius.all(rrectRadius);

    Widget content = Container(
      padding: widget.padding,
      decoration: BoxDecoration(
        color: widget.surfaceColor ??
            (widget.surfaceGradient == null
                ? LiquidGlassTheme.glassFill(context)
                : null),
        gradient: widget.surfaceGradient ??
            (widget.surfaceColor == null
                ? LiquidGlassTheme.glassSurfaceGradient(context)
                : null),
      ),
      child: widget.child,
    );

    // Specular border overlay
    if (widget.hasBorder) {
      content = CustomPaint(
        foregroundPainter: _SpecularBorderPainter(
          borderRadius: widget.borderRadius,
          borderColors: LiquidGlassTheme.specularBorderColors(context),
          strokeWidth: isDark ? 0.9 : 1.2,
        ),
        child: content,
      );
    }

    // Apply BackdropFilter blur if enabled
    if (widget.enableBlur && widget.blurSigma > 0) {
      content = ClipRRect(
        borderRadius: rrect,
        child: BackdropFilter(
          filter: ImageFilter.blur(
            sigmaX: widget.blurSigma,
            sigmaY: widget.blurSigma,
          ),
          child: content,
        ),
      );
    } else {
      content = ClipRRect(
        borderRadius: rrect,
        child: content,
      );
    }

    // Outer shadow container
    Widget glassBox = Container(
      margin: widget.margin,
      decoration: BoxDecoration(
        borderRadius: rrect,
        boxShadow: widget.elevation > 0
            ? LiquidGlassTheme.glassShadows(context, elevation: widget.elevation)
            : null,
      ),
      child: content,
    );

    // Wrap in RepaintBoundary to isolate the blur layer from re-rendering the whole screen
    glassBox = RepaintBoundary(child: glassBox);

    // Interactive scale feedback
    if (widget.interactive || widget.onTap != null || widget.onLongPress != null) {
      return GestureDetector(
        onTapDown: _handleTapDown,
        onTapUp: _handleTapUp,
        onTapCancel: _handleTapCancel,
        onTap: () {
          if (widget.interactive) {
            HapticFeedback.selectionClick();
          }
          widget.onTap?.call();
        },
        onLongPress: widget.onLongPress,
        child: AnimatedScale(
          scale: _isPressed ? 0.982 : 1.0,
          duration: const Duration(milliseconds: 140),
          curve: Curves.easeOutCubic,
          child: glassBox,
        ),
      );
    }

    return glassBox;
  }
}

/// Custom painter that paints a crisp directional specular highlight border along the rounded rect.
class _SpecularBorderPainter extends CustomPainter {
  final double borderRadius;
  final List<Color> borderColors;
  final double strokeWidth;

  _SpecularBorderPainter({
    required this.borderRadius,
    required this.borderColors,
    required this.strokeWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0 || size.height <= 0) return;

    final rect = Offset.zero & size;
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(borderRadius));

    // Deflate rect slightly so stroke falls neatly on boundary
    final halfStroke = strokeWidth / 2;
    final strokeRRect = rrect.deflate(halfStroke);

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: borderColors,
        stops: borderColors.length == 3 ? const [0.0, 0.45, 1.0] : null,
      ).createShader(rect);

    canvas.drawRRect(strokeRRect, paint);
  }

  @override
  bool shouldRepaint(covariant _SpecularBorderPainter oldDelegate) {
    return oldDelegate.borderRadius != borderRadius ||
        oldDelegate.strokeWidth != strokeWidth ||
        oldDelegate.borderColors != borderColors;
  }
}
