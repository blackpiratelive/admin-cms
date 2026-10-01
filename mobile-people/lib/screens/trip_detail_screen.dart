import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/models/trip_record.dart';
import '../core/models/trip_day.dart';
import '../core/models/trip_detail.dart';
import '../core/network/api_service.dart';
import '../core/network/sync_service.dart';
import '../core/storage/local_store.dart';
import '../core/services/image_cache_manager.dart';
import '../core/theme/cupertino_theme.dart';
import '../widgets/image_lightbox.dart';
import '../widgets/trip_status_badge.dart';
import '../widgets/trip_day_timeline.dart';
import '../widgets/trip_map_view.dart';
import 'trip_form_modal.dart';
import 'trip_day_editor_modal.dart';
import 'trip_connect_modal.dart';
import 'photo_picker_modal.dart';

class TripDetailScreen extends StatefulWidget {
  final String tripIdOrSlug;
  final TripRecord? initialTrip;
  final VoidCallback? onTripChanged;

  const TripDetailScreen({
    super.key,
    required this.tripIdOrSlug,
    this.initialTrip,
    this.onTripChanged,
  });

  @override
  State<TripDetailScreen> createState() => _TripDetailScreenState();
}

class _TripDetailScreenState extends State<TripDetailScreen> {
  TripRecord? _trip;
  TripDetailResult? _detail;
  bool _isLoading = true;
  int _tabIndex = 0;

  static const List<String> _tabs = ['Itinerary', 'Places', 'Map', 'Photos', 'Posts', 'People', 'Movies'];

  @override
  void initState() {
    super.initState();
    _trip = widget.initialTrip;
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final cached = await LocalStore.getCachedTripDetail(widget.tripIdOrSlug);
    if (cached != null && mounted) {
      final result = TripDetailResult.fromJson(cached);
      setState(() {
        _detail = result;
        _trip = result.trip;
        _isLoading = false;
      });
    }

    final isStale = await LocalStore.isTripDetailCacheStale(widget.tripIdOrSlug);
    if (cached == null || isStale) {
      await _fetch(forceRefresh: false);
    } else if (mounted && _isLoading) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _fetch({bool forceRefresh = false}) async {
    try {
      final result = await ApiService.getTripDetail(widget.tripIdOrSlug, forceRefresh: forceRefresh);
      if (result != null && mounted) {
        setState(() {
          _detail = result;
          _trip = result.trip;
          _isLoading = false;
        });
      } else if (mounted) {
        setState(() => _isLoading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleFavorite() async {
    final trip = _trip;
    if (trip == null) return;
    final newFav = !trip.favorite;
    setState(() => _trip = trip.copyWith(favorite: newFav));
    await LocalStore.toggleCachedTripFavorite(trip.id, newFav);
    widget.onTripChanged?.call();
    try {
      await ApiService.toggleTripFavorite(trip.id, newFav);
    } catch (_) {
      await SyncService.queueMutation(
        type: 'toggle_trip_favorite',
        entityId: trip.id,
        payload: {'favorite': newFav},
      );
    }
  }

  Future<void> _duplicate() async {
    final trip = _trip;
    if (trip == null) return;
    try {
      final dup = await ApiService.duplicateTrip(trip.id);
      widget.onTripChanged?.call();
      if (dup != null && mounted) {
        _showToast('Trip duplicated');
      }
    } catch (_) {
      if (mounted) _showToast('Duplicate requires a connection');
    }
  }

  Future<void> _delete() async {
    final trip = _trip;
    if (trip == null) return;
    await LocalStore.deleteCachedTrip(trip.id);
    try {
      await ApiService.deleteTrip(trip.id);
    } catch (_) {
      await SyncService.queueMutation(type: 'delete_trip', entityId: trip.id, payload: {});
    }
    widget.onTripChanged?.call();
    if (mounted) Navigator.of(context).pop();
  }

  void _showToast(String message) {
    showCupertinoDialog<void>(
      context: context,
      builder: (ctx) {
        Future.delayed(const Duration(milliseconds: 900), () {
          if (ctx.mounted) Navigator.of(ctx).pop();
        });
        return CupertinoAlertDialog(content: Text(message));
      },
    );
  }

  void _confirmDelete() {
    showCupertinoDialog<void>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Delete Trip'),
        content: Text('Delete "${_trip?.title ?? 'this trip'}"?'),
        actions: [
          CupertinoDialogAction(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () {
              Navigator.pop(ctx);
              _delete();
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showActions() {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => CupertinoActionSheet(
        actions: [
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(ctx);
              if (_trip != null) {
                TripFormModal.show(context, tripToEdit: _trip, onSuccess: () {
                  widget.onTripChanged?.call();
                  _fetch(forceRefresh: true);
                });
              }
            },
            child: const Text('Edit Trip'),
          ),
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(ctx);
              _duplicate();
            },
            child: const Text('Duplicate Trip'),
          ),
          CupertinoActionSheetAction(
            isDestructiveAction: true,
            onPressed: () {
              Navigator.pop(ctx);
              _confirmDelete();
            },
            child: const Text('Delete Trip'),
          ),
        ],
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Cancel'),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final trip = _trip;

    return CupertinoPageScaffold(
      backgroundColor: CupertinoColors.systemGroupedBackground,
      navigationBar: CupertinoNavigationBar(
        middle: Text(
          trip?.displayTitle.isNotEmpty == true ? trip!.displayTitle : (trip?.title ?? 'Trip'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CupertinoButton(
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              onPressed: _toggleFavorite,
              child: Icon(
                trip?.favorite == true ? CupertinoIcons.star_fill : CupertinoIcons.star,
                size: 22,
                color: trip?.favorite == true ? AppCupertinoTheme.favoriteGold : AppCupertinoTheme.brandAccent,
              ),
            ),
            const SizedBox(width: 4),
            CupertinoButton(
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              onPressed: _showActions,
              child: const Icon(CupertinoIcons.ellipsis_circle, size: 22),
            ),
          ],
        ),
      ),
      child: trip == null
          ? const Center(child: CupertinoActivityIndicator(radius: 14))
          : SafeArea(
              top: false,
              child: ListView(
                padding: const EdgeInsets.only(bottom: 40),
                children: [
                  _buildHero(context, trip),
                  _buildTabBar(context),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _buildTabContent(context),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildHero(BuildContext context, TripRecord trip) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 180,
          width: double.infinity,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (trip.hasCover)
                CachedNetworkImage(
                  cacheManager: PeopleImageCacheManager.instance,
                  imageUrl: trip.coverImageUrl!,
                  fit: BoxFit.cover,
                  errorWidget: (_, _, _) =>
                      DecoratedBox(decoration: BoxDecoration(gradient: coverGradientFor(trip.fallbackCoverTheme))),
                  placeholder: (_, _) =>
                      DecoratedBox(decoration: BoxDecoration(gradient: coverGradientFor(trip.fallbackCoverTheme))),
                )
              else
                DecoratedBox(decoration: BoxDecoration(gradient: coverGradientFor(trip.fallbackCoverTheme))),
              Positioned(
                left: 16,
                bottom: 12,
                child: TripStatusBadge(status: trip.status),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                trip.displayTitle.isNotEmpty ? trip.displayTitle : trip.title,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.6, color: labelColor),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(CupertinoIcons.calendar, size: 14, color: secondaryColor),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(trip.dateRangeFormatted,
                        style: TextStyle(fontSize: 14, color: secondaryColor)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 16,
                runSpacing: 6,
                children: [
                  _stat(context, CupertinoIcons.calendar_today, '${trip.duration}', 'days'),
                  _stat(context, CupertinoIcons.placemark, '${trip.placesCount}', 'places'),
                  _stat(context, CupertinoIcons.photo, '${trip.photosCount}', 'photos'),
                  if (trip.spendFormatted != null && trip.spendFormatted!.isNotEmpty)
                    _stat(context, CupertinoIcons.money_dollar_circle, trip.spendFormatted!, 'spend'),
                ],
              ),
              if (trip.description != null && trip.description!.trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                MarkdownBody(data: trip.description!),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _stat(BuildContext context, IconData icon, String value, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: AppCupertinoTheme.brandAccent),
        const SizedBox(width: 5),
        Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppCupertinoTheme.label(context))),
        const SizedBox(width: 3),
        Text(label, style: TextStyle(fontSize: 13, color: AppCupertinoTheme.secondary(context))),
      ],
    );
  }

  Widget _buildTabBar(BuildContext context) {
    final labelColor = AppCupertinoTheme.label(context);
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        itemCount: _tabs.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final selected = _tabIndex == i;
          return GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _tabIndex = i);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: selected ? AppCupertinoTheme.brandAccent : AppCupertinoTheme.subtleFill.resolveFrom(context),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Text(
                _tabs[i],
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? CupertinoColors.white : labelColor,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  /// Refetch detail after any mutation and notify the list screen.
  Future<void> _refresh() async {
    widget.onTripChanged?.call();
    await _fetch(forceRefresh: true);
  }

  Widget _manageBar(BuildContext context, List<Widget> actions) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(children: actions),
    );
  }

  Widget _actionButton(IconData icon, String label, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: CupertinoButton(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        minimumSize: Size.zero,
        onPressed: onTap,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: AppCupertinoTheme.brandAccent),
            const SizedBox(width: 5),
            Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppCupertinoTheme.brandAccent)),
          ],
        ),
      ),
    );
  }

  Future<void> _addDay() async {
    final trip = _trip;
    if (trip == null) return;
    try {
      await ApiService.addTripDay(trip.id);
      await _refresh();
    } catch (_) {
      if (mounted) _showToast('Could not add day');
    }
  }

  Future<void> _generateDays() async {
    final trip = _trip;
    if (trip == null) return;
    try {
      await ApiService.generateTripDays(trip.id);
      await _refresh();
    } catch (_) {
      if (mounted) _showToast('Set trip dates first');
    }
  }

  void _editDay(TripDay day) {
    final trip = _trip;
    if (trip == null) return;
    TripDayEditorModal.show(context, tripId: trip.id, day: day, onSaved: _refresh);
  }

  Future<void> _removeConnection(String? relationshipId) async {
    final trip = _trip;
    if (trip == null || relationshipId == null) return;
    try {
      await ApiService.removeTripConnection(trip.id, relationshipId);
      await _refresh();
    } catch (_) {
      if (mounted) _showToast('Could not remove');
    }
  }

  Future<void> _removePhoto(String connectionId) async {
    final trip = _trip;
    if (trip == null) return;
    try {
      await ApiService.removeTripPhoto(trip.id, connectionId);
      await _refresh();
    } catch (_) {
      if (mounted) _showToast('Could not remove photo');
    }
  }

  void _linkEntity(String targetType) {
    final trip = _trip;
    if (trip == null) return;
    TripConnectModal.show(context, tripId: trip.id, targetType: targetType, onConnected: _refresh);
  }

  void _addPhotos() {
    final trip = _trip;
    if (trip == null) return;
    PhotoPickerModal.showGeneric(
      context,
      headerTitle: trip.title,
      defaultVerb: 'taken_at',
      onConnect: (photos, relationship) =>
          ApiService.connectTripPhotos(trip.id, photos, relationship: relationship),
      onSuccess: _refresh,
    );
  }

  Widget _buildTabContent(BuildContext context) {
    final detail = _detail;
    if (detail == null) {
      return const Padding(
        padding: EdgeInsets.all(40),
        child: Center(child: CupertinoActivityIndicator()),
      );
    }

    switch (_tabIndex) {
      case 0:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _manageBar(context, [
              _actionButton(CupertinoIcons.add, 'Add day', _addDay),
              _actionButton(CupertinoIcons.calendar_badge_plus, 'Generate', _generateDays),
            ]),
            TripDayTimeline(days: detail.days, onEditDay: _editDay),
          ],
        );
      case 1:
        return _locationsTab(context, detail);
      case 2:
        return TripMapView(routeStops: detail.routeStops, missingCoords: detail.missingCoords);
      case 3:
        return _photosTab(context, detail);
      case 4:
        return _microblogsTab(context, detail);
      case 5:
        return _peopleTab(context, detail);
      case 6:
        return _moviesTab(context, detail);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _emptyTab(BuildContext context, IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Center(
        child: Column(
          children: [
            Icon(icon, size: 40, color: CupertinoColors.systemGrey),
            const SizedBox(height: 10),
            Text(text, style: TextStyle(fontSize: 14, color: AppCupertinoTheme.secondary(context))),
          ],
        ),
      ),
    );
  }

  Widget _cardList(BuildContext context, List<Widget> rows) {
    return Container(
      decoration: BoxDecoration(
        color: AppCupertinoTheme.cardBackground.resolveFrom(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppCupertinoTheme.cardBorder.resolveFrom(context), width: 0.6),
      ),
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(children: rows),
    );
  }

  Widget _locationsTab(BuildContext context, TripDetailResult detail) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _manageBar(context, [_actionButton(CupertinoIcons.add, 'Link location', () => _linkEntity('location'))]),
        if (detail.locations.isEmpty)
          _emptyTab(context, CupertinoIcons.placemark, 'No linked locations')
        else
          _cardList(
            context,
            [
              for (final loc in detail.locations)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  child: Row(
                    children: [
                      const Icon(CupertinoIcons.placemark_fill, size: 18, color: AppCupertinoTheme.brandAccent),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(loc.name,
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: labelColor)),
                            if (loc.subtitle.isNotEmpty)
                              Text(loc.subtitle, style: TextStyle(fontSize: 12.5, color: secondaryColor)),
                          ],
                        ),
                      ),
                      if (loc.relationshipId != null)
                        CupertinoButton(
                          padding: EdgeInsets.zero,
                          minimumSize: Size.zero,
                          onPressed: () => _removeConnection(loc.relationshipId),
                          child: const Icon(CupertinoIcons.minus_circle, size: 20, color: CupertinoColors.systemRed),
                        ),
                    ],
                  ),
                ),
            ],
          ),
      ],
    );
  }

  Widget _photosTab(BuildContext context, TripDetailResult detail) {
    final urls = detail.photos.map((p) => p.fullUrl).where((u) => u.isNotEmpty).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _manageBar(context, [_actionButton(CupertinoIcons.add, 'Add photos', _addPhotos)]),
        if (detail.photos.isEmpty)
          _emptyTab(context, CupertinoIcons.photo, 'No photos yet')
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.only(top: 4),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 6,
              mainAxisSpacing: 6,
            ),
            itemCount: detail.photos.length,
            itemBuilder: (context, idx) {
              final photo = detail.photos[idx];
              final isDay = photo.sourceType == 'day';
              return GestureDetector(
                onTap: () => ImageLightbox.show(context, urls, initialIndex: idx),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: CachedNetworkImage(
                        cacheManager: PeopleImageCacheManager.instance,
                        imageUrl: photo.thumbUrl,
                        fit: BoxFit.cover,
                        errorWidget: (_, _, _) => Container(
                          color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                          child: const Icon(CupertinoIcons.photo, color: CupertinoColors.systemGrey),
                        ),
                      ),
                    ),
                    // Day photos are managed from the day editor, not detachable here.
                    if (isDay)
                      Positioned(
                        left: 4,
                        bottom: 4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: CupertinoColors.black.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text('Day ${photo.sourceDayNumber ?? ''}'.trim(),
                              style: const TextStyle(color: CupertinoColors.white, fontSize: 9, fontWeight: FontWeight.w600)),
                        ),
                      )
                    else
                      Positioned(
                        top: 2,
                        right: 2,
                        child: CupertinoButton(
                          padding: const EdgeInsets.all(2),
                          minimumSize: Size.zero,
                          onPressed: () => _removePhoto(photo.id),
                          child: Container(
                            decoration: BoxDecoration(
                              color: CupertinoColors.black.withValues(alpha: 0.4),
                              shape: BoxShape.circle,
                            ),
                            padding: const EdgeInsets.all(2),
                            child: const Icon(CupertinoIcons.xmark, size: 13, color: CupertinoColors.white),
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }

  Widget _microblogsTab(BuildContext context, TripDetailResult detail) {
    if (detail.microblogs.isEmpty) {
      return _emptyTab(context, CupertinoIcons.text_bubble, 'No linked posts');
    }
    return Column(
      children: [
        for (final mb in detail.microblogs)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppCupertinoTheme.cardBackground.resolveFrom(context),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppCupertinoTheme.cardBorder.resolveFrom(context), width: 0.6),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MarkdownBody(data: mb.contentMarkdown.isNotEmpty ? mb.contentMarkdown : '_(no content)_'),
                const SizedBox(height: 6),
                Text(mb.status,
                    style: TextStyle(
                        fontSize: 11.5,
                        color: AppCupertinoTheme.secondary(context),
                        fontWeight: FontWeight.w600)),
              ],
            ),
          ),
      ],
    );
  }

  Widget _peopleTab(BuildContext context, TripDetailResult detail) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _manageBar(context, [_actionButton(CupertinoIcons.add, 'Link person', () => _linkEntity('person'))]),
        if (detail.people.isEmpty)
          _emptyTab(context, CupertinoIcons.person_2, 'No linked people')
        else
          _cardList(
            context,
            [
              for (final person in detail.people)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  child: Row(
                    children: [
                      if (person.hasAvatar)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(18),
                          child: CachedNetworkImage(
                            cacheManager: PeopleImageCacheManager.instance,
                            imageUrl: person.avatarUrl!,
                            width: 36,
                            height: 36,
                            fit: BoxFit.cover,
                            errorWidget: (_, _, _) => _personInitials(person),
                          ),
                        )
                      else
                        _personInitials(person),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(person.displayName,
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: labelColor)),
                            Text(person.relationshipType, style: TextStyle(fontSize: 12.5, color: secondaryColor)),
                          ],
                        ),
                      ),
                      if (person.relationshipId != null)
                        CupertinoButton(
                          padding: EdgeInsets.zero,
                          minimumSize: Size.zero,
                          onPressed: () => _removeConnection(person.relationshipId),
                          child: const Icon(CupertinoIcons.minus_circle, size: 20, color: CupertinoColors.systemRed),
                        ),
                    ],
                  ),
                ),
            ],
          ),
      ],
    );
  }

  Widget _moviesTab(BuildContext context, TripDetailResult detail) {
    if (detail.movies.isEmpty) {
      return _emptyTab(context, CupertinoIcons.film, 'No linked movies');
    }
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.only(top: 4),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio: 0.62,
      ),
      itemCount: detail.movies.length,
      itemBuilder: (context, idx) {
        final movie = detail.movies[idx];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: movie.posterUrl != null
                    ? CachedNetworkImage(
                        cacheManager: PeopleImageCacheManager.instance,
                        imageUrl: movie.posterUrl!,
                        fit: BoxFit.cover,
                        width: double.infinity,
                        errorWidget: (_, _, _) => _moviePlaceholder(context),
                      )
                    : _moviePlaceholder(context),
              ),
            ),
            const SizedBox(height: 4),
            Text(movie.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: labelColor)),
            if (movie.year != null)
              Text('${movie.year}', style: TextStyle(fontSize: 11, color: secondaryColor)),
          ],
        );
      },
    );
  }

  Widget _moviePlaceholder(BuildContext context) {
    return Container(
      color: AppCupertinoTheme.subtleFill.resolveFrom(context),
      child: const Center(child: Icon(CupertinoIcons.film, color: CupertinoColors.systemGrey, size: 28)),
    );
  }

  Widget _personInitials(TripPersonRef person) {
    return Container(
      width: 36,
      height: 36,
      decoration: const BoxDecoration(shape: BoxShape.circle, gradient: AppCupertinoTheme.brandGradient),
      alignment: Alignment.center,
      child: Text(person.initials,
          style: const TextStyle(color: CupertinoColors.white, fontSize: 13, fontWeight: FontWeight.w700)),
    );
  }
}
