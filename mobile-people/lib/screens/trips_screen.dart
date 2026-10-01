import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/models/trip_record.dart';
import '../core/network/api_service.dart';
import '../core/network/sync_service.dart';
import '../core/storage/local_store.dart';
import '../core/theme/cupertino_theme.dart';
import '../core/util/trip_format.dart';
import '../widgets/trip_card.dart';
import 'trip_detail_screen.dart';
import 'trip_form_modal.dart';

class TripsScreen extends StatefulWidget {
  const TripsScreen({super.key});

  @override
  State<TripsScreen> createState() => _TripsScreenState();
}

class _TripsScreenState extends State<TripsScreen> with WidgetsBindingObserver {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();

  List<TripRecord> _allTrips = [];
  List<TripRecord> _filteredTrips = [];
  int _pendingSyncCount = 0;
  bool _isLoading = true;

  String _searchQuery = '';
  String _filter = 'all'; // all | upcoming | ongoing | completed | favorites
  String _sort = 'recent'; // recent | oldest | duration | title

  static const List<({String key, String label})> _filterChips = [
    (key: 'all', label: 'All'),
    (key: 'upcoming', label: 'Upcoming'),
    (key: 'ongoing', label: 'Ongoing'),
    (key: 'completed', label: 'Completed'),
    (key: 'favorites', label: '★ Favorites'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bootstrap();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      SyncService.processQueue().then((_) async {
        final q = await LocalStore.getOfflineQueue();
        if (mounted) setState(() => _pendingSyncCount = q.length);
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  String get _todayIso => DateTime.now().toIso8601String().substring(0, 10);

  List<TripRecord> _applyFilters(List<TripRecord> source) {
    return filterAndSortTrips(source, _searchQuery, _filter, _sort, todayIso: _todayIso);
  }

  Future<void> _bootstrap() async {
    final cached = await LocalStore.getCachedTrips();
    final queue = await LocalStore.getOfflineQueue();
    if (mounted) {
      setState(() {
        _allTrips = cached;
        _filteredTrips = _applyFilters(cached);
        _pendingSyncCount = queue.length;
        if (cached.isNotEmpty) _isLoading = false;
      });
    }

    SyncService.processQueue().then((_) async {
      final q = await LocalStore.getOfflineQueue();
      if (mounted) setState(() => _pendingSyncCount = q.length);
    });

    final isStale = await LocalStore.isTripsCacheStale();
    if (cached.isEmpty || isStale) {
      await _fetchData(forceRefresh: false);
    } else if (mounted && _isLoading) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchData({bool forceRefresh = false}) async {
    try {
      final trips = await ApiService.getTrips(forceRefresh: forceRefresh);
      final queue = await LocalStore.getOfflineQueue();
      if (mounted) {
        setState(() {
          _allTrips = trips;
          _filteredTrips = _applyFilters(trips);
          _pendingSyncCount = queue.length;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _onLocalDataChanged() async {
    final cached = await LocalStore.getCachedTrips();
    final queue = await LocalStore.getOfflineQueue();
    if (mounted) {
      setState(() {
        _allTrips = cached;
        _filteredTrips = _applyFilters(cached);
        _pendingSyncCount = queue.length;
      });
    }
    if (queue.isNotEmpty) {
      SyncService.processQueue().then((_) async {
        final q = await LocalStore.getOfflineQueue();
        if (mounted) setState(() => _pendingSyncCount = q.length);
      });
    }
  }

  void _onSearchChanged(String query) {
    setState(() {
      _searchQuery = query;
      _filteredTrips = _applyFilters(_allTrips);
    });
  }

  void _setFilter(String key) {
    HapticFeedback.selectionClick();
    setState(() {
      _filter = key;
      _filteredTrips = _applyFilters(_allTrips);
    });
  }

  void _openDetail(TripRecord trip) {
    Navigator.of(context).push(
      CupertinoPageRoute(
        builder: (_) => TripDetailScreen(
          tripIdOrSlug: trip.id,
          initialTrip: trip,
          onTripChanged: _onLocalDataChanged,
        ),
      ),
    ).then((_) => _onLocalDataChanged());
  }

  void _openAddTrip() {
    HapticFeedback.lightImpact();
    TripFormModal.show(context, onSuccess: _onLocalDataChanged);
  }

  Future<void> _handleToggleFavorite(TripRecord trip) async {
    final newFav = !trip.favorite;
    await LocalStore.toggleCachedTripFavorite(trip.id, newFav);
    setState(() {
      final idx = _allTrips.indexWhere((t) => t.id == trip.id);
      if (idx != -1) _allTrips[idx] = _allTrips[idx].copyWith(favorite: newFav);
      _filteredTrips = _applyFilters(_allTrips);
    });

    try {
      await ApiService.toggleTripFavorite(trip.id, newFav);
    } catch (_) {
      await SyncService.queueMutation(
        type: 'toggle_trip_favorite',
        entityId: trip.id,
        payload: {'favorite': newFav},
      );
      final q = await LocalStore.getOfflineQueue();
      if (mounted) setState(() => _pendingSyncCount = q.length);
    }
  }

  Future<void> _handleDelete(TripRecord trip) async {
    await LocalStore.deleteCachedTrip(trip.id);
    setState(() {
      _allTrips = List<TripRecord>.from(_allTrips)..removeWhere((t) => t.id == trip.id);
      _filteredTrips = _applyFilters(_allTrips);
    });
    try {
      await ApiService.deleteTrip(trip.id);
    } catch (_) {
      await SyncService.queueMutation(type: 'delete_trip', entityId: trip.id, payload: {});
      final q = await LocalStore.getOfflineQueue();
      if (mounted) setState(() => _pendingSyncCount = q.length);
    }
  }

  Future<void> _handleDuplicate(TripRecord trip) async {
    try {
      await ApiService.duplicateTrip(trip.id);
      await _fetchData(forceRefresh: true);
    } catch (_) {
      // Duplication requires the server; ignore when offline.
    }
  }

  void _showSortSheet() {
    HapticFeedback.lightImpact();
    showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => CupertinoActionSheet(
        title: const Text('Sort trips'),
        actions: [
          _sortAction(ctx, 'recent', 'Most recent'),
          _sortAction(ctx, 'oldest', 'Oldest first'),
          _sortAction(ctx, 'duration', 'Longest duration'),
          _sortAction(ctx, 'title', 'Title (A–Z)'),
        ],
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Cancel'),
        ),
      ),
    );
  }

  CupertinoActionSheetAction _sortAction(BuildContext ctx, String key, String label) {
    return CupertinoActionSheetAction(
      onPressed: () {
        Navigator.pop(ctx);
        setState(() {
          _sort = key;
          _filteredTrips = _applyFilters(_allTrips);
        });
      },
      child: Text(
        label,
        style: TextStyle(
          fontWeight: _sort == key ? FontWeight.bold : FontWeight.normal,
          color: _sort == key ? AppCupertinoTheme.brandAccent : null,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);

    return CupertinoPageScaffold(
      backgroundColor: CupertinoColors.systemGroupedBackground,
      child: CustomScrollView(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        slivers: [
          CupertinoSliverRefreshControl(
            refreshTriggerPullDistance: 80.0,
            refreshIndicatorExtent: 60.0,
            onRefresh: () async {
              HapticFeedback.mediumImpact();
              await SyncService.processQueue();
              await _fetchData(forceRefresh: true);
              final q = await LocalStore.getOfflineQueue();
              if (mounted) setState(() => _pendingSyncCount = q.length);
            },
          ),

          // Header
          SliverSafeArea(
            top: true,
            bottom: false,
            sliver: SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Trips',
                            style: TextStyle(
                              fontSize: 34,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -1.0,
                              color: labelColor,
                              height: 1.15,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            _allTrips.isNotEmpty
                                ? '${_allTrips.length} ${_allTrips.length == 1 ? 'trip' : 'trips'}${_pendingSyncCount > 0 ? ' • $_pendingSyncCount pending sync' : ''}'
                                : (_isLoading ? 'Loading trips...' : 'No trips yet'),
                            style: TextStyle(fontSize: 15, color: secondaryColor),
                          ),
                        ],
                      ),
                    ),
                    CupertinoButton(
                      padding: EdgeInsets.zero,
                      onPressed: _openAddTrip,
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: AppCupertinoTheme.brandGradient,
                          boxShadow: [
                            BoxShadow(
                              color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.32),
                              offset: const Offset(0, 3),
                              blurRadius: 10,
                            ),
                          ],
                        ),
                        child: const Icon(CupertinoIcons.add, color: CupertinoColors.white, size: 24),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Search + sort row
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 50,
                      decoration: BoxDecoration(
                        color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      child: Row(
                        children: [
                          const Icon(CupertinoIcons.search, size: 20, color: CupertinoColors.systemGrey),
                          const SizedBox(width: 10),
                          Expanded(
                            child: CupertinoTextField(
                              controller: _searchController,
                              padding: EdgeInsets.zero,
                              decoration: const BoxDecoration(),
                              placeholder: 'Search trips, places, tags...',
                              placeholderStyle: TextStyle(fontSize: 15, color: secondaryColor),
                              style: TextStyle(fontSize: 15, color: labelColor),
                              clearButtonMode: OverlayVisibilityMode.editing,
                              onChanged: _onSearchChanged,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  GestureDetector(
                    onTap: _showSortSheet,
                    child: Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      alignment: Alignment.center,
                      child: Icon(CupertinoIcons.sort_down, size: 22, color: labelColor),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Filter chips rail
          SliverToBoxAdapter(child: _buildFilterRail(context)),

          // Trip list body
          if (_isLoading && _allTrips.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(child: CupertinoActivityIndicator(radius: 14)),
            )
          else if (_filteredTrips.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(CupertinoIcons.map, size: 48, color: CupertinoColors.systemGrey),
                      const SizedBox(height: 12),
                      Text(
                        'No Trips Found',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: labelColor),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _searchQuery.isNotEmpty || _filter != 'all'
                            ? 'No trips match your search or filter.'
                            : 'Plan your first adventure by adding a trip.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: secondaryColor),
                      ),
                      const SizedBox(height: 16),
                      CupertinoButton.filled(onPressed: _openAddTrip, child: const Text('Add Trip')),
                    ],
                  ),
                ),
              ),
            )
          else
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 6, 20, 0),
                child: Column(
                  children: [
                    for (final trip in _filteredTrips) ...[
                      TripCard(
                        trip: trip,
                        onTap: () => _openDetail(trip),
                        onToggleFavorite: () => _handleToggleFavorite(trip),
                        onEdit: () => TripFormModal.show(context, tripToEdit: trip, onSuccess: _onLocalDataChanged),
                        onDuplicate: () => _handleDuplicate(trip),
                        onDelete: () => _handleDelete(trip),
                      ),
                      const SizedBox(height: 12),
                    ],
                  ],
                ),
              ),
            ),

          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ),
    );
  }

  Widget _buildFilterRail(BuildContext context) {
    final labelColor = AppCupertinoTheme.label(context);
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
        itemCount: _filterChips.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, idx) {
          final chip = _filterChips[idx];
          final selected = _filter == chip.key;
          return GestureDetector(
            onTap: () => _setFilter(chip.key),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: selected
                    ? AppCupertinoTheme.brandAccent
                    : AppCupertinoTheme.cardBackground.resolveFrom(context),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: selected
                      ? AppCupertinoTheme.brandAccent
                      : AppCupertinoTheme.cardBorder.resolveFrom(context),
                  width: 0.8,
                ),
              ),
              child: Text(
                chip.label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                  color: selected ? CupertinoColors.white : labelColor,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
