import 'dart:ui';
import 'package:flutter/cupertino.dart';
import '../core/theme/liquid_glass_theme.dart';

/// A dynamic, living ambient mesh gradient background that sits behind the canvas.
/// It renders soft glowing aurora light pools that react subtly to scrolling
/// and theme brightness, providing vibrant illumination that refracts through
/// liquid glass elements.
class AmbientMeshBackground extends StatefulWidget {
  final Widget? child;
  final ScrollController? scrollController;

  const AmbientMeshBackground({
    super.key,
    this.child,
    this.scrollController,
  });

  @override
  State<AmbientMeshBackground> createState() => _AmbientMeshBackgroundState();
}

class _AmbientMeshBackgroundState extends State<AmbientMeshBackground> {
  double _scrollOffset = 0.0;

  @override
  void initState() {
    super.initState();
    widget.scrollController?.addListener(_onScroll);
  }

  @override
  void didUpdateWidget(covariant AmbientMeshBackground oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.scrollController != widget.scrollController) {
      oldWidget.scrollController?.removeListener(_onScroll);
      widget.scrollController?.addListener(_onScroll);
    }
  }

  @override
  void dispose() {
    widget.scrollController?.removeListener(_onScroll);
    super.dispose();
  }

  void _onScroll() {
    if (widget.scrollController != null && mounted) {
      setState(() {
        _scrollOffset = widget.scrollController!.hasClients
            ? widget.scrollController!.offset
            : 0.0;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = LiquidGlassTheme.isDark(context);
    final palette = LiquidGlassTheme.auroraPalette(context);

    // Subtle scroll parallax
    final parallaxY = (_scrollOffset * 0.15) % 300.0;

    return Stack(
      fit: StackFit.expand,
      children: [
        // 1. Foundation Base Color
        Container(
          color: isDark
              ? const Color(0xFF0F0F14)
              : const Color(0xFFF4F5F9),
        ),

        // 2. Aurora Light Pools
        Positioned.fill(
          child: CustomPaint(
            painter: _AuroraMeshPainter(
              colors: palette,
              isDark: isDark,
              parallaxOffset: parallaxY,
            ),
          ),
        ),

        // 3. Ultra-soft diffusion blur over the canvas
        Positioned.fill(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 45, sigmaY: 45),
            child: const SizedBox.expand(),
          ),
        ),

        // 4. Foreground Content
        if (widget.child != null) widget.child!,
      ],
    );
  }
}

class _AuroraMeshPainter extends CustomPainter {
  final List<Color> colors;
  final bool isDark;
  final double parallaxOffset;

  _AuroraMeshPainter({
    required this.colors,
    required this.isDark,
    required this.parallaxOffset,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0 || size.height <= 0) return;

    final primaryAlpha = isDark ? 0.38 : 0.28;
    final secondaryAlpha = isDark ? 0.30 : 0.22;

    // Orb 1: Top Right (Sapphire / Sky)
    final p1 = Paint()
      ..shader = RadialGradient(
        colors: [
          colors[0].withValues(alpha: primaryAlpha),
          colors[0].withValues(alpha: 0.0),
        ],
      ).createShader(
        Rect.fromCircle(
          center: Offset(size.width * 0.85, (size.height * 0.15) - parallaxOffset),
          radius: size.width * 0.65,
        ),
      );
    canvas.drawCircle(
      Offset(size.width * 0.85, (size.height * 0.15) - parallaxOffset),
      size.width * 0.65,
      p1,
    );

    // Orb 2: Center Left (Violet / Lavender)
    final p2 = Paint()
      ..shader = RadialGradient(
        colors: [
          colors[1].withValues(alpha: secondaryAlpha),
          colors[1].withValues(alpha: 0.0),
        ],
      ).createShader(
        Rect.fromCircle(
          center: Offset(size.width * 0.1, (size.height * 0.5) + (parallaxOffset * 0.5)),
          radius: size.width * 0.6,
        ),
      );
    canvas.drawCircle(
      Offset(size.width * 0.1, (size.height * 0.5) + (parallaxOffset * 0.5)),
      size.width * 0.6,
      p2,
    );

    // Orb 3: Bottom Right (Cyan / Mint)
    if (colors.length > 2) {
      final p3 = Paint()
        ..shader = RadialGradient(
          colors: [
            colors[2].withValues(alpha: secondaryAlpha),
            colors[2].withValues(alpha: 0.0),
          ],
        ).createShader(
          Rect.fromCircle(
            center: Offset(size.width * 0.75, (size.height * 0.85) - (parallaxOffset * 0.3)),
            radius: size.width * 0.7,
          ),
        );
      canvas.drawCircle(
        Offset(size.width * 0.75, (size.height * 0.85) - (parallaxOffset * 0.3)),
        size.width * 0.7,
        p3,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _AuroraMeshPainter oldDelegate) {
    return oldDelegate.parallaxOffset != parallaxOffset ||
        oldDelegate.isDark != isDark ||
        oldDelegate.colors != colors;
  }
}
