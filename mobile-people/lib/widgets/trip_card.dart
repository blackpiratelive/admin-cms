import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/models/trip_record.dart';
import '../core/services/image_cache_manager.dart';
import '../core/theme/cupertino_theme.dart';
import 'trip_status_badge.dart';

class TripCard extends StatelessWidget {
  final TripRecord trip;
  final VoidCallback onTap;
  final VoidCallback? onToggleFavorite;
  final VoidCallback? onEdit;
  final VoidCallback? onDuplicate;
  final VoidCallback? onDelete;

  const TripCard({
    super.key,
    required this.trip,
    required this.onTap,
    this.onToggleFavorite,
    this.onEdit,
    this.onDuplicate,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      onLongPress: () {
        HapticFeedback.heavyImpact();
        _showActionSheet(context);
      },
      child: Container(
        decoration: BoxDecoration(
          color: AppCupertinoTheme.cardBackground.resolveFrom(context),
          borderRadius: BorderRadius.circular(16),
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
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildCover(context),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    trip.displayTitle.isNotEmpty ? trip.displayTitle : trip.title,
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.4,
                      color: labelColor,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(CupertinoIcons.calendar, size: 12, color: secondaryColor),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          trip.dateRangeFormatted,
                          style: TextStyle(fontSize: 13, color: secondaryColor),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _buildMetaRow(context, secondaryColor),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCover(BuildContext context) {
    return SizedBox(
      height: 120,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (trip.hasCover)
            CachedNetworkImage(
              cacheManager: PeopleImageCacheManager.instance,
              imageUrl: trip.coverImageUrl!,
              fit: BoxFit.cover,
              errorWidget: (_, _, _) => DecoratedBox(
                decoration: BoxDecoration(gradient: coverGradientFor(trip.fallbackCoverTheme)),
              ),
              placeholder: (_, _) => DecoratedBox(
                decoration: BoxDecoration(gradient: coverGradientFor(trip.fallbackCoverTheme)),
              ),
            )
          else
            DecoratedBox(
              decoration: BoxDecoration(gradient: coverGradientFor(trip.fallbackCoverTheme)),
              child: Center(
                child: Icon(
                  CupertinoIcons.map,
                  size: 40,
                  color: CupertinoColors.white.withValues(alpha: 0.85),
                ),
              ),
            ),

          // Status badge (top-left)
          Positioned(
            top: 10,
            left: 10,
            child: TripStatusBadge(status: trip.status, compact: true),
          ),

          // Favorite star (top-right)
          Positioned(
            top: 4,
            right: 4,
            child: CupertinoButton(
              padding: const EdgeInsets.all(8),
              minimumSize: Size.zero,
              onPressed: () {
                HapticFeedback.lightImpact();
                onToggleFavorite?.call();
              },
              child: Container(
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  color: CupertinoColors.black.withValues(alpha: 0.28),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  trip.favorite ? CupertinoIcons.star_fill : CupertinoIcons.star,
                  size: 18,
                  color: trip.favorite ? AppCupertinoTheme.favoriteGold : CupertinoColors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetaRow(BuildContext context, Color secondaryColor) {
    return Wrap(
      spacing: 14,
      runSpacing: 6,
      children: [
        _metaChip(CupertinoIcons.calendar_today, '${trip.duration}d', secondaryColor),
        if (trip.placesCount > 0)
          _metaChip(CupertinoIcons.placemark, '${trip.placesCount} ${trip.placesCount == 1 ? 'place' : 'places'}', secondaryColor),
        if (trip.photosCount > 0)
          _metaChip(CupertinoIcons.photo, '${trip.photosCount}', secondaryColor),
        if (trip.spendFormatted != null && trip.spendFormatted!.isNotEmpty)
          _metaChip(CupertinoIcons.money_dollar_circle, trip.spendFormatted!, secondaryColor),
      ],
    );
  }

  Widget _metaChip(IconData icon, String text, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(fontSize: 12.5, color: color, fontWeight: FontWeight.w500)),
      ],
    );
  }

  void _showActionSheet(BuildContext context) {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (sheetContext) => CupertinoActionSheet(
        title: Text(trip.title),
        message: Text('${TripStatusBadge.styleFor(trip.status).label} • ${trip.dateRangeFormatted}'),
        actions: [
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(sheetContext);
              onTap();
            },
            child: const Text('Open Trip'),
          ),
          if (onEdit != null)
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.pop(sheetContext);
                onEdit?.call();
              },
              child: const Text('Edit Trip'),
            ),
          if (onToggleFavorite != null)
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.pop(sheetContext);
                onToggleFavorite?.call();
              },
              child: Text(trip.favorite ? 'Unmark Favorite' : 'Mark Favorite'),
            ),
          if (onDuplicate != null)
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.pop(sheetContext);
                onDuplicate?.call();
              },
              child: const Text('Duplicate Trip'),
            ),
          if (onDelete != null)
            CupertinoActionSheetAction(
              isDestructiveAction: true,
              onPressed: () {
                Navigator.pop(sheetContext);
                _confirmDelete(context);
              },
              child: const Text('Delete Trip'),
            ),
        ],
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.pop(sheetContext),
          child: const Text('Cancel'),
        ),
      ),
    );
  }

  void _confirmDelete(BuildContext context) {
    showCupertinoDialog<void>(
      context: context,
      builder: (dialogContext) => CupertinoAlertDialog(
        title: const Text('Delete Trip'),
        content: Text('Delete "${trip.title}"? This removes the trip and its itinerary links.'),
        actions: [
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () {
              Navigator.pop(dialogContext);
              onDelete?.call();
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
