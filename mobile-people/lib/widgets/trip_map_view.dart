import 'package:flutter/cupertino.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../core/models/trip_detail.dart';
import '../core/theme/cupertino_theme.dart';

/// Interactive OpenStreetMap route for a trip (flutter_map, no token needed).
class TripMapView extends StatelessWidget {
  final List<TripMapStop> routeStops;
  final List<TripMapStop> missingCoords;

  const TripMapView({
    super.key,
    required this.routeStops,
    this.missingCoords = const [],
  });

  @override
  Widget build(BuildContext context) {
    final located = routeStops.where((s) => s.hasCoords).toList();
    final points = located.map((s) => LatLng(s.latitude!, s.longitude!)).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (points.isEmpty)
          _noCoordsCard(context)
        else
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: SizedBox(
              height: 300,
              child: FlutterMap(
                options: MapOptions(
                  initialCenter: points.first,
                  initialZoom: points.length == 1 ? 10 : 5,
                  initialCameraFit: points.length > 1
                      ? CameraFit.coordinates(
                          coordinates: points,
                          padding: const EdgeInsets.all(44),
                        )
                      : null,
                  interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                  ),
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.admincms.mobilepeople',
                  ),
                  if (points.length > 1)
                    PolylineLayer(
                      polylines: [
                        Polyline(
                          points: points,
                          color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.85),
                          strokeWidth: 3.5,
                        ),
                      ],
                    ),
                  MarkerLayer(markers: _buildMarkers(located)),
                ],
              ),
            ),
          ),
        const SizedBox(height: 12),
        _stopList(context, located),
        if (missingCoords.isNotEmpty) ...[
          const SizedBox(height: 12),
          _missingCard(context),
        ],
      ],
    );
  }

  List<Marker> _buildMarkers(List<TripMapStop> located) {
    final markers = <Marker>[];
    int number = 0;
    for (final s in located) {
      final isWaypoint = s.stopType == 'transport_waypoint';
      final color = s.isAssociatedLocation
          ? AppCupertinoTheme.favoriteGold
          : AppCupertinoTheme.brandAccent;
      if (isWaypoint) {
        markers.add(
          Marker(
            point: LatLng(s.latitude!, s.longitude!),
            width: 16,
            height: 16,
            child: Container(
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.9),
                shape: BoxShape.circle,
                border: Border.all(color: CupertinoColors.white, width: 1.5),
              ),
            ),
          ),
        );
      } else {
        number += 1;
        markers.add(
          Marker(
            point: LatLng(s.latitude!, s.longitude!),
            width: 30,
            height: 30,
            child: Container(
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                border: Border.all(color: CupertinoColors.white, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: CupertinoColors.black.withValues(alpha: 0.3),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Text(
                '$number',
                style: const TextStyle(
                  color: CupertinoColors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        );
      }
    }
    return markers;
  }

  Widget _noCoordsCard(BuildContext context) {
    return Container(
      height: 160,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppCupertinoTheme.subtleFill.resolveFrom(context),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(CupertinoIcons.map, size: 36, color: CupertinoColors.systemGrey),
          const SizedBox(height: 8),
          Text(
            'No mapped stops yet',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppCupertinoTheme.label(context),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Add GPS coordinates to itinerary stops in the web CMS.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12.5, color: AppCupertinoTheme.secondary(context)),
          ),
        ],
      ),
    );
  }

  Widget _stopList(BuildContext context, List<TripMapStop> located) {
    if (located.isEmpty) return const SizedBox.shrink();
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);
    int number = 0;

    return Container(
      decoration: BoxDecoration(
        color: AppCupertinoTheme.cardBackground.resolveFrom(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppCupertinoTheme.cardBorder.resolveFrom(context), width: 0.6),
      ),
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        children: located.map((s) {
          final isWaypoint = s.stopType == 'transport_waypoint';
          if (!isWaypoint) number += 1;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: (s.isAssociatedLocation
                            ? AppCupertinoTheme.favoriteGold
                            : AppCupertinoTheme.brandAccent)
                        .withValues(alpha: isWaypoint ? 0.4 : 1),
                    shape: BoxShape.circle,
                  ),
                  child: isWaypoint
                      ? const Icon(CupertinoIcons.smallcircle_fill_circle, size: 10, color: CupertinoColors.white)
                      : Text('$number',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: CupertinoColors.white)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(s.name,
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: labelColor),
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      if (s.locationLabel.isNotEmpty)
                        Text(s.locationLabel,
                            style: TextStyle(fontSize: 12, color: secondaryColor),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
                if (s.isAssociatedLocation)
                  const Icon(CupertinoIcons.star_fill, size: 13, color: AppCupertinoTheme.favoriteGold),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _missingCard(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: CupertinoColors.systemOrange.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: CupertinoColors.systemOrange.withValues(alpha: 0.3), width: 0.8),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(CupertinoIcons.exclamationmark_triangle, size: 15, color: CupertinoColors.systemOrange),
              const SizedBox(width: 6),
              Text(
                'Missing coordinates (${missingCoords.length})',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppCupertinoTheme.label(context),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: missingCoords
                .map((s) => Text('• ${s.name}',
                    style: TextStyle(fontSize: 12.5, color: AppCupertinoTheme.secondary(context))))
                .toList(),
          ),
        ],
      ),
    );
  }
}
