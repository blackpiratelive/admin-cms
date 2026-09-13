import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/models/person_record.dart';
import '../core/models/upcoming_birthday_item.dart';
import '../core/network/api_service.dart';
import '../core/network/sync_service.dart';
import '../core/services/notification_service.dart';
import '../core/storage/local_store.dart';
import '../core/theme/cupertino_theme.dart';
import '../widgets/upcoming_birthdays_widget.dart';
import '../widgets/person_card.dart';
import 'person_detail_screen.dart';
import 'person_form_modal.dart';

class DirectoryScreen extends StatefulWidget {
  final VoidCallback onLogout;

  const DirectoryScreen({
    super.key,
    required this.onLogout,
  });

  @override
  State<DirectoryScreen> createState() => _DirectoryScreenState();
}

class _DirectoryScreenState extends State<DirectoryScreen> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();

  List<PersonRecord> _allPeople = [];
  List<PersonRecord> _filteredPeople = [];
  List<UpcomingBirthdayItem> _birthdays = [];
  int _pendingSyncCount = 0;
  bool _isLoading = true;

  // Active filters
  String _searchQuery = '';
  String _selectedRelationship = 'all';
  int? _selectedMonth;
  String _selectedVisibility = 'all';
  bool _favoriteOnly = false;
  String _sortBy = 'created_desc';

  static const List<String> relationshipFilterPresets = [
    'all',
    'Friend',
    'Family',
    'Partner',
    'Relative',
    'Colleague',
    'Classmate',
    'Neighbor',
    'Mentor',
  ];

  static const List<String> monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  /// 100% Client-Side In-Memory Filtering and Sorting (0ms latency, works fully offline)
  List<PersonRecord> _applyFiltersAndSort(List<PersonRecord> source) {
    var result = List<PersonRecord>.from(source);

    // 1. Search Query across name, nickname, notes, tags, and interests
    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.trim().toLowerCase();
      result = result.where((p) {
        final nameMatch = p.displayName.toLowerCase().contains(q) ||
            (p.firstName?.toLowerCase().contains(q) ?? false) ||
            (p.lastName?.toLowerCase().contains(q) ?? false);
        final nicknameMatch = p.nickname?.toLowerCase().contains(q) ?? false;
        final notesMatch = p.notesMarkdown?.toLowerCase().contains(q) ?? false;
        final tagMatch = p.tags.any((t) => t.toLowerCase().contains(q));
        final interestMatch = p.interests.any((i) => i.toLowerCase().contains(q));
        final relMatch = p.relationshipType.toLowerCase().contains(q);
        return nameMatch || nicknameMatch || notesMatch || tagMatch || interestMatch || relMatch;
      }).toList();
    }

    // 2. Relationship Filter
    if (_selectedRelationship != 'all') {
      result = result.where((p) => p.relationshipType.toLowerCase() == _selectedRelationship.toLowerCase()).toList();
    }

    // 3. Favorites Only
    if (_favoriteOnly) {
      result = result.where((p) => p.favorite).toList();
    }

    // 4. Birthday Month
    if (_selectedMonth != null) {
      result = result.where((p) {
        return p.importantDates.any((d) {
          try {
            final parts = d.date.split('-');
            int? m;
            if (parts.length >= 3) {
              m = int.tryParse(parts[1]);
            } else if (parts.length == 2) {
              m = int.tryParse(parts[0]);
            }
            return m == _selectedMonth;
          } catch (_) {
            return false;
          }
        });
      }).toList();
    }

    // 5. Visibility Filter
    if (_selectedVisibility != 'all') {
      result = result.where((p) => p.visibility.toLowerCase() == _selectedVisibility.toLowerCase()).toList();
    }

    // 6. Sort By
    result.sort((a, b) {
      switch (_sortBy) {
        case 'name_asc':
          return a.displayName.toLowerCase().compareTo(b.displayName.toLowerCase());
        case 'name_desc':
          return b.displayName.toLowerCase().compareTo(a.displayName.toLowerCase());
        case 'favorite':
          if (a.favorite != b.favorite) {
            return a.favorite ? -1 : 1;
          }
          return a.displayName.toLowerCase().compareTo(b.displayName.toLowerCase());
        case 'created_asc':
          return (a.createdAt ?? '').compareTo(b.createdAt ?? '');
        case 'created_desc':
        default:
          return (b.createdAt ?? '').compareTo(a.createdAt ?? '');
      }
    });

    return result;
  }

  Future<void> _bootstrap() async {
    // 1. Instant paint from cache (0ms perceived latency)
    final cachedPeople = await LocalStore.getCachedPeople();
    final cachedBirthdays = await LocalStore.getCachedBirthdays();
    final queue = await LocalStore.getOfflineQueue();

    if (mounted) {
      setState(() {
        _allPeople = cachedPeople;
        _filteredPeople = _applyFiltersAndSort(cachedPeople);
        _birthdays = cachedBirthdays;
        _pendingSyncCount = queue.length;
        if (cachedPeople.isNotEmpty) {
          _isLoading = false;
        }
      });
    }

    // 2. Process pending offline mutations in background
    SyncService.processQueue().then((_) async {
      final q = await LocalStore.getOfflineQueue();
      if (mounted) setState(() => _pendingSyncCount = q.length);
    });

    // 3. Only fetch from server if cache is empty or stale (>7 days TTL)
    final isStale = await LocalStore.isPeopleCacheStale() || await LocalStore.isBirthdaysCacheStale();
    if (cachedPeople.isEmpty || isStale) {
      await _fetchData(forceRefresh: false);
    } else {
      if (mounted && _isLoading) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _fetchData({bool forceRefresh = false}) async {
    try {
      final [peopleRes, birthdaysRes] = await Future.wait([
        ApiService.getPeople(forceRefresh: forceRefresh, limit: 500),
        ApiService.getUpcomingBirthdays(forceRefresh: forceRefresh, limit: 10),
      ]);

      final peopleResult = peopleRes as PeopleFetchResult;
      final birthdaysList = birthdaysRes as List<UpcomingBirthdayItem>;
      final queue = await LocalStore.getOfflineQueue();

      if (mounted) {
        setState(() {
          _allPeople = peopleResult.items;
          _filteredPeople = _applyFiltersAndSort(peopleResult.items);
          _birthdays = birthdaysList;
          _pendingSyncCount = queue.length;
          _isLoading = false;
        });

        // Schedule notifications for loaded contacts
        NotificationService.scheduleAllReminders(peopleResult.items);
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// Instant local refresh when returning from modals or detail changes
  Future<void> _onLocalDataChanged() async {
    final cached = await LocalStore.getCachedPeople();
    final birthdays = await LocalStore.getCachedBirthdays();
    final queue = await LocalStore.getOfflineQueue();
    if (mounted) {
      setState(() {
        _allPeople = cached;
        _filteredPeople = _applyFiltersAndSort(cached);
        _birthdays = birthdays;
        _pendingSyncCount = queue.length;
      });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    setState(() {
      _searchQuery = query;
      _filteredPeople = _applyFiltersAndSort(_allPeople);
    });
  }

  void _openDetail(PersonRecord person) {
    Navigator.of(context).push(
      CupertinoPageRoute(
        builder: (_) => PersonDetailScreen(
          personIdOrSlug: person.id,
          initialPerson: person,
          onPersonChanged: _onLocalDataChanged,
        ),
      ),
    );
  }

  void _openAddPerson() {
    HapticFeedback.lightImpact();
    PersonFormModal.show(
      context,
      onSuccess: _onLocalDataChanged,
    );
  }

  Future<void> _handleToggleFavorite(PersonRecord person) async {
    final newFav = !person.favorite;
    final updated = person.copyWith(favorite: newFav);

    // 1. Optimistic instant local update
    await LocalStore.toggleCachedPersonFavorite(person.id, newFav);
    setState(() {
      final idx = _allPeople.indexWhere((p) => p.id == person.id);
      if (idx != -1) _allPeople[idx] = updated;
      _filteredPeople = _applyFiltersAndSort(_allPeople);
    });

    // 2. Background sync
    try {
      await ApiService.toggleFavorite(person.id);
    } catch (_) {
      await SyncService.queueMutation(
        type: 'toggle_favorite',
        entityId: person.id,
        payload: {'favorite': newFav},
      );
      final q = await LocalStore.getOfflineQueue();
      if (mounted) setState(() => _pendingSyncCount = q.length);
    }
  }

  Future<void> _handleDeletePerson(PersonRecord person) async {
    // 1. Optimistic instant local removal
    await LocalStore.deleteCachedPerson(person.id);
    setState(() {
      _allPeople.removeWhere((p) => p.id == person.id);
      _filteredPeople = _applyFiltersAndSort(_allPeople);
    });

    // 2. Background sync
    try {
      await ApiService.deletePerson(person.id);
    } catch (_) {
      await SyncService.queueMutation(
        type: 'delete_person',
        entityId: person.id,
        payload: {},
      );
      final q = await LocalStore.getOfflineQueue();
      if (mounted) setState(() => _pendingSyncCount = q.length);
    }
  }

  bool get _hasActiveFilters =>
      _selectedRelationship != 'all' ||
      _selectedMonth != null ||
      _selectedVisibility != 'all' ||
      _favoriteOnly ||
      _sortBy != 'created_desc';

  void _showFilterSheet(BuildContext context) {
    HapticFeedback.lightImpact();
    String tempRelationship = _selectedRelationship;
    int? tempMonth = _selectedMonth;
    String tempVisibility = _selectedVisibility;
    bool tempFavoriteOnly = _favoriteOnly;
    String tempSortBy = _sortBy;

    showCupertinoModalPopup<void>(
      context: context,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final labelColor = AppCupertinoTheme.label(context);
            final secondaryColor = AppCupertinoTheme.secondary(context);
            return Container(
              height: MediaQuery.of(context).size.height * 0.82,
              decoration: BoxDecoration(
                color: CupertinoColors.systemGroupedBackground.resolveFrom(context),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  children: [
                    // Sheet Header / Bar
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppCupertinoTheme.cardBackground.resolveFrom(context),
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
                        border: Border(
                          bottom: BorderSide(
                            color: AppCupertinoTheme.cardBorder.resolveFrom(context),
                            width: 0.5,
                          ),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          CupertinoButton(
                            padding: EdgeInsets.zero,
                            onPressed: () {
                              setSheetState(() {
                                tempRelationship = 'all';
                                tempMonth = null;
                                tempVisibility = 'all';
                                tempFavoriteOnly = false;
                                tempSortBy = 'created_desc';
                              });
                            },
                            child: const Text(
                              'Reset',
                              style: TextStyle(
                                color: CupertinoColors.systemRed,
                                fontSize: 16,
                              ),
                            ),
                          ),
                          Text(
                            'Filters',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: labelColor,
                            ),
                          ),
                          CupertinoButton(
                            padding: EdgeInsets.zero,
                            onPressed: () {
                              Navigator.pop(sheetContext);
                              setState(() {
                                _selectedRelationship = tempRelationship;
                                _selectedMonth = tempMonth;
                                _selectedVisibility = tempVisibility;
                                _favoriteOnly = tempFavoriteOnly;
                                _sortBy = tempSortBy;
                                _filteredPeople = _applyFiltersAndSort(_allPeople);
                              });
                            },
                            child: const Text(
                              'Done',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: AppCupertinoTheme.brandAccent,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Filter Content
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        children: [
                          // Section: Favorites Toggle
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppCupertinoTheme.cardBackground.resolveFrom(context),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: AppCupertinoTheme.cardBorder.resolveFrom(context),
                                  width: 0.6,
                                ),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(
                                        CupertinoIcons.star_fill,
                                        color: Color(0xFFEAB308),
                                        size: 20,
                                      ),
                                      const SizedBox(width: 12),
                                      Text(
                                        'Only Favorites',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w500,
                                          color: labelColor,
                                        ),
                                      ),
                                    ],
                                  ),
                                  CupertinoSwitch(
                                    value: tempFavoriteOnly,
                                    activeTrackColor: AppCupertinoTheme.brandAccent,
                                    onChanged: (val) {
                                      HapticFeedback.selectionClick();
                                      setSheetState(() => tempFavoriteOnly = val);
                                    },
                                  ),
                                ],
                              ),
                            ),
                          ),

                          // Section: Sort Order
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                            child: Text(
                              'SORT BY',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: secondaryColor,
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppCupertinoTheme.cardBackground.resolveFrom(context),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: AppCupertinoTheme.cardBorder.resolveFrom(context),
                                  width: 0.6,
                                ),
                              ),
                              child: Column(
                                children: [
                                  _buildSortRow(
                                    title: 'Recently Added (Newest)',
                                    value: 'created_desc',
                                    currentValue: tempSortBy,
                                    onSelect: (v) => setSheetState(() => tempSortBy = v),
                                    showDivider: true,
                                    context: context,
                                  ),
                                  _buildSortRow(
                                    title: 'First Added (Oldest)',
                                    value: 'created_asc',
                                    currentValue: tempSortBy,
                                    onSelect: (v) => setSheetState(() => tempSortBy = v),
                                    showDivider: true,
                                    context: context,
                                  ),
                                  _buildSortRow(
                                    title: 'Name (A to Z)',
                                    value: 'name_asc',
                                    currentValue: tempSortBy,
                                    onSelect: (v) => setSheetState(() => tempSortBy = v),
                                    showDivider: true,
                                    context: context,
                                  ),
                                  _buildSortRow(
                                    title: 'Name (Z to A)',
                                    value: 'name_desc',
                                    currentValue: tempSortBy,
                                    onSelect: (v) => setSheetState(() => tempSortBy = v),
                                    showDivider: true,
                                    context: context,
                                  ),
                                  _buildSortRow(
                                    title: 'Favorites First',
                                    value: 'favorite',
                                    currentValue: tempSortBy,
                                    onSelect: (v) => setSheetState(() => tempSortBy = v),
                                    showDivider: false,
                                    context: context,
                                  ),
                                ],
                              ),
                            ),
                          ),

                          // Section: Relationship
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                            child: Text(
                              'RELATIONSHIP',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: secondaryColor,
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: relationshipFilterPresets.map((r) {
                                final isSelected = tempRelationship.toLowerCase() == r.toLowerCase();
                                final displayLabel = r == 'all' ? 'All Relationships' : r;
                                return GestureDetector(
                                  onTap: () {
                                    HapticFeedback.selectionClick();
                                    setSheetState(() => tempRelationship = r);
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? AppCupertinoTheme.brandAccent
                                          : AppCupertinoTheme.cardBackground.resolveFrom(context),
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(
                                        color: isSelected
                                            ? AppCupertinoTheme.brandAccent
                                            : AppCupertinoTheme.cardBorder.resolveFrom(context),
                                        width: 0.8,
                                      ),
                                    ),
                                    child: Text(
                                      displayLabel,
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                                        color: isSelected
                                            ? CupertinoColors.white
                                            : labelColor,
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),

                          // Section: Birthday Month
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                            child: Text(
                              'BIRTHDAY MONTH',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: secondaryColor,
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: List.generate(12, (i) {
                                final monthNum = i + 1;
                                final isSelected = tempMonth == monthNum;
                                return GestureDetector(
                                  onTap: () {
                                    HapticFeedback.selectionClick();
                                    setSheetState(() {
                                      tempMonth = isSelected ? null : monthNum;
                                    });
                                  },
                                  child: Container(
                                    width: (MediaQuery.of(context).size.width - 40 - 24) / 4,
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? AppCupertinoTheme.brandAccent
                                          : AppCupertinoTheme.cardBackground.resolveFrom(context),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: isSelected
                                            ? AppCupertinoTheme.brandAccent
                                            : AppCupertinoTheme.cardBorder.resolveFrom(context),
                                        width: 0.8,
                                      ),
                                    ),
                                    child: Text(
                                      monthNames[i],
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                                        color: isSelected
                                            ? CupertinoColors.white
                                            : labelColor,
                                      ),
                                    ),
                                  ),
                                );
                              }),
                            ),
                          ),

                          // Section: Visibility
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                            child: Text(
                              'VISIBILITY',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: secondaryColor,
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(3),
                              decoration: BoxDecoration(
                                color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: CupertinoSlidingSegmentedControl<String>(
                                groupValue: tempVisibility,
                                thumbColor: AppCupertinoTheme.cardBackground.resolveFrom(context),
                                children: {
                                  'all': Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    child: Text('All', style: TextStyle(fontSize: 13, color: labelColor)),
                                  ),
                                  'private': Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    child: Text('Private', style: TextStyle(fontSize: 13, color: labelColor)),
                                  ),
                                  'unlisted': Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    child: Text('Unlisted', style: TextStyle(fontSize: 13, color: labelColor)),
                                  ),
                                  'public': Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    child: Text('Public', style: TextStyle(fontSize: 13, color: labelColor)),
                                  ),
                                },
                                onValueChanged: (val) {
                                  if (val != null) {
                                    HapticFeedback.selectionClick();
                                    setSheetState(() => tempVisibility = val);
                                  }
                                },
                              ),
                            ),
                          ),

                          const SizedBox(height: 32),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildSortRow({
    required String title,
    required String value,
    required String currentValue,
    required ValueChanged<String> onSelect,
    required bool showDivider,
    required BuildContext context,
  }) {
    final isSelected = value == currentValue;
    final labelColor = AppCupertinoTheme.label(context);

    return Column(
      children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            HapticFeedback.selectionClick();
            onSelect(value);
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 15,
                    color: labelColor,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
                if (isSelected)
                  const Icon(
                    CupertinoIcons.checkmark,
                    color: AppCupertinoTheme.brandAccent,
                    size: 18,
                  ),
              ],
            ),
          ),
        ),
        if (showDivider)
          Container(
            margin: const EdgeInsets.only(left: 16),
            height: 0.5,
            color: AppCupertinoTheme.cardBorder.resolveFrom(context),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);

    return CupertinoPageScaffold(
      backgroundColor: CupertinoColors.systemGroupedBackground,
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          controller: _scrollController,
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          slivers: [
            // Pull-to-refresh: forces fresh sync from backend and flushes queue
            CupertinoSliverRefreshControl(
              onRefresh: () async {
                await SyncService.processQueue();
                await _fetchData(forceRefresh: true);
              },
            ),

            // Header Section: "People" + Count + Primary Add Button
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'People',
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
                            _allPeople.isNotEmpty
                                ? '${_allPeople.length} ${_allPeople.length == 1 ? 'person' : 'people'} in your circle${_pendingSyncCount > 0 ? ' • $_pendingSyncCount pending sync' : ''}'
                                : (_isLoading ? 'Loading circle...' : '0 people in your circle'),
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w400,
                              letterSpacing: -0.2,
                              color: secondaryColor,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Primary Add Action Button
                    CupertinoButton(
                      padding: EdgeInsets.zero,
                      onPressed: _openAddPerson,
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
                        child: const Icon(
                          CupertinoIcons.add,
                          color: CupertinoColors.white,
                          size: 24,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Search & Filter Row
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    // Search Input (50px tall, subtle gray background, rounded radius 14)
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
                            const Icon(
                              CupertinoIcons.search,
                              size: 20,
                              color: CupertinoColors.systemGrey,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: CupertinoTextField(
                                controller: _searchController,
                                padding: EdgeInsets.zero,
                                decoration: const BoxDecoration(),
                                placeholder: 'Search people, notes, interests...',
                                placeholderStyle: TextStyle(
                                  fontSize: 15,
                                  color: secondaryColor,
                                ),
                                style: TextStyle(
                                  fontSize: 15,
                                  color: labelColor,
                                ),
                                clearButtonMode: OverlayVisibilityMode.editing,
                                onChanged: _onSearchChanged,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),

                    // Adjacent Filter Button
                    GestureDetector(
                      onTap: () => _showFilterSheet(context),
                      child: Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: _hasActiveFilters
                              ? AppCupertinoTheme.brandAccent.withValues(alpha: 0.12)
                              : AppCupertinoTheme.subtleFill.resolveFrom(context),
                          borderRadius: BorderRadius.circular(14),
                          border: _hasActiveFilters
                              ? Border.all(color: AppCupertinoTheme.brandAccent, width: 1.2)
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: Icon(
                          CupertinoIcons.slider_horizontal_3,
                          size: 20,
                          color: _hasActiveFilters
                              ? AppCupertinoTheme.brandAccent
                              : labelColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Coming up Section (Upcoming dates & birthdays)
            if (_birthdays.isNotEmpty)
              SliverToBoxAdapter(
                child: UpcomingBirthdaysWidget(
                  items: _birthdays,
                  onItemTap: (item) {
                    final matching = _allPeople.firstWhere(
                      (p) => p.id == item.personId || (p.slug.isNotEmpty && p.slug == item.slug),
                      orElse: () => PersonRecord(
                        id: item.personId,
                        displayName: item.displayName,
                        slug: item.slug,
                        avatarUrl: item.avatarUrl,
                        relationshipType: item.relationshipType ?? 'Friend',
                        favorite: false,
                      ),
                    );
                    _openDetail(matching);
                  },
                ),
              ),

            // "Your people" Section Heading
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      'Your people',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5,
                        color: labelColor,
                      ),
                    ),
                    GestureDetector(
                      onTap: () => _showFilterSheet(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: _hasActiveFilters
                              ? AppCupertinoTheme.brandAccent.withValues(alpha: 0.12)
                              : AppCupertinoTheme.subtleFill.resolveFrom(context),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _hasActiveFilters
                                ? AppCupertinoTheme.brandAccent
                                : AppCupertinoTheme.cardBorder.resolveFrom(context),
                            width: 0.8,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              CupertinoIcons.slider_horizontal_3,
                              size: 13,
                              color: _hasActiveFilters
                                  ? AppCupertinoTheme.brandAccent
                                  : labelColor,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Filter',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: _hasActiveFilters
                                    ? AppCupertinoTheme.brandAccent
                                    : labelColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // People List Container
            if (_isLoading && _allPeople.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: CupertinoActivityIndicator(radius: 14),
                ),
              )
            else if (_filteredPeople.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          CupertinoIcons.person_2,
                          size: 48,
                          color: CupertinoColors.systemGrey,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'No Contacts Found',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: labelColor,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _searchQuery.isNotEmpty || _hasActiveFilters
                              ? 'No people match your active search filters.'
                              : 'Start building your circle by adding your first friend, classmate, or partner.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            color: secondaryColor,
                          ),
                        ),
                        const SizedBox(height: 16),
                        CupertinoButton.filled(
                          onPressed: _openAddPerson,
                          child: const Text('Add Person'),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
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
                    child: ListView.builder(
                      padding: EdgeInsets.zero,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _filteredPeople.length,
                      itemBuilder: (context, index) {
                        final person = _filteredPeople[index];
                        final isLast = index == _filteredPeople.length - 1;
                        return PersonCard(
                          person: person,
                          showDivider: !isLast,
                          onTap: () => _openDetail(person),
                          onToggleFavorite: () => _handleToggleFavorite(person),
                          onEdit: () {
                            PersonFormModal.show(
                              context,
                              personToEdit: person,
                              onSuccess: _onLocalDataChanged,
                            );
                          },
                          onDelete: () => _handleDeletePerson(person),
                        );
                      },
                    ),
                  ),
                ),
              ),

            // Bottom Spacing (above tab bar)
            const SliverToBoxAdapter(
              child: SizedBox(height: 32),
            ),
          ],
        ),
      ),
    );
  }
}
