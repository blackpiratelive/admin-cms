import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/models/person_record.dart';
import '../core/models/upcoming_birthday_item.dart';
import '../core/network/api_service.dart';
import '../core/network/sync_service.dart';
import '../core/services/notification_service.dart';
import '../core/storage/local_store.dart';
import '../core/theme/liquid_glass_theme.dart';
import '../widgets/ambient_mesh_background.dart';
import '../widgets/floating_glass_header.dart';
import '../widgets/upcoming_birthdays_widget.dart';
import '../widgets/person_card.dart';
import 'person_detail_screen.dart';
import 'person_form_modal.dart';
import 'settings_screen.dart';

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

  List<PersonRecord> _people = [];
  List<UpcomingBirthdayItem> _birthdays = [];
  int _pendingSyncCount = 0;
  bool _isLoading = true;
  bool _showFilters = false;

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

  Future<void> _bootstrap() async {
    // 1. Instant paint from cache
    final cachedPeople = await LocalStore.getCachedPeople();
    final cachedBirthdays = await LocalStore.getCachedBirthdays();
    final queue = await LocalStore.getOfflineQueue();

    if (mounted) {
      setState(() {
        if (cachedPeople.isNotEmpty) {
          _people = cachedPeople;
          _isLoading = false;
        }
        _birthdays = cachedBirthdays;
        _pendingSyncCount = queue.length;
      });
    }

    // 2. Process pending offline mutations
    await SyncService.processQueue();

    // 3. Fetch fresh data from server
    await _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final [peopleRes, birthdaysRes] = await Future.wait([
        ApiService.getPeople(
          search: _searchQuery,
          relationshipType: _selectedRelationship,
          favorite: _favoriteOnly ? true : null,
          birthdayMonth: _selectedMonth,
          visibility: _selectedVisibility,
          sortBy: _sortBy,
        ),
        ApiService.getUpcomingBirthdays(limit: 10),
      ]);

      final peopleResult = peopleRes as PeopleFetchResult;
      final birthdaysList = birthdaysRes as List<UpcomingBirthdayItem>;
      final queue = await LocalStore.getOfflineQueue();

      if (mounted) {
        setState(() {
          _people = peopleResult.items;
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

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    setState(() => _searchQuery = query);
    _fetchData();
  }

  void _onSelectRelationship(String rel) {
    setState(() => _selectedRelationship = rel);
    HapticFeedback.selectionClick();
    _fetchData();
  }

  void _onSelectMonth(int? month) {
    setState(() {
      _selectedMonth = (_selectedMonth == month) ? null : month;
    });
    HapticFeedback.selectionClick();
    _fetchData();
  }

  void _toggleFavoriteFilter() {
    setState(() => _favoriteOnly = !_favoriteOnly);
    HapticFeedback.selectionClick();
    _fetchData();
  }

  void _showSortSheet() {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => CupertinoActionSheet(
        title: const Text('Sort Contacts'),
        actions: [
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() => _sortBy = 'created_desc');
              _fetchData();
            },
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('Recently Added'),
                if (_sortBy == 'created_desc') const SizedBox(width: 8),
                if (_sortBy == 'created_desc') const Icon(CupertinoIcons.checkmark, size: 16),
              ],
            ),
          ),
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() => _sortBy = 'updated_desc');
              _fetchData();
            },
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('Recently Updated'),
                if (_sortBy == 'updated_desc') const SizedBox(width: 8),
                if (_sortBy == 'updated_desc') const Icon(CupertinoIcons.checkmark, size: 16),
              ],
            ),
          ),
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() => _sortBy = 'name');
              _fetchData();
            },
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('Name (A-Z)'),
                if (_sortBy == 'name') const SizedBox(width: 8),
                if (_sortBy == 'name') const Icon(CupertinoIcons.checkmark, size: 16),
              ],
            ),
          ),
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() => _sortBy = 'memory_score');
              _fetchData();
            },
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('Memory Score'),
                if (_sortBy == 'memory_score') const SizedBox(width: 8),
                if (_sortBy == 'memory_score') const Icon(CupertinoIcons.checkmark, size: 16),
              ],
            ),
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

  void _openDetail(String idOrSlug) {
    Navigator.of(context).push(
      CupertinoPageRoute(
        builder: (_) => PersonDetailScreen(
          personIdOrSlug: idOrSlug,
          onPersonChanged: _fetchData,
        ),
      ),
    );
  }

  Future<void> _handleToggleFavorite(PersonRecord person) async {
    final newFav = !person.favorite;
    setState(() {
      final idx = _people.indexWhere((p) => p.id == person.id);
      if (idx != -1) {
        _people[idx] = person.copyWith(favorite: newFav);
      }
    });

    try {
      await ApiService.toggleFavorite(person.id);
    } catch (_) {
      await SyncService.queueMutation(
        type: 'toggle_favorite',
        entityId: person.id,
        payload: {'favorite': newFav},
      );
    }
  }

  Future<void> _handleDeletePerson(PersonRecord person) async {
    setState(() {
      _people.removeWhere((p) => p.id == person.id);
    });

    try {
      await ApiService.deletePerson(person.id);
      _fetchData();
    } catch (_) {
      await SyncService.queueMutation(
        type: 'delete_person',
        entityId: person.id,
        payload: {},
      );
      _fetchData();
    }
  }

  bool get _hasActiveFilters =>
      _selectedRelationship != 'all' ||
      _selectedMonth != null ||
      _selectedVisibility != 'all' ||
      _favoriteOnly ||
      _sortBy != 'created_desc';

  @override
  Widget build(BuildContext context) {
    final isDark = LiquidGlassTheme.isDark(context);

    return CupertinoPageScaffold(
      child: AmbientMeshBackground(
        scrollController: _scrollController,
        child: Stack(
          children: [
            // Scrollable Content
            CustomScrollView(
              controller: _scrollController,
              physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics(),
              ),
              slivers: [
                // Top Safe Area Spacer for Floating Header
                const SliverToBoxAdapter(
                  child: SizedBox(height: 84),
                ),

                // Pull to Refresh
                CupertinoSliverRefreshControl(
                  onRefresh: () async {
                    await SyncService.processQueue();
                    await _fetchData();
                  },
                ),

                // Upcoming Birthdays Widget
                if (_birthdays.isNotEmpty)
                  SliverToBoxAdapter(
                    child: UpcomingBirthdaysWidget(
                      items: _birthdays,
                      onItemTap: (item) => _openDetail(item.personId),
                    ),
                  ),

                // Search Bar
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: CupertinoSearchTextField(
                      controller: _searchController,
                      placeholder: 'Search name, nickname, interests, notes...',
                      onChanged: _onSearchChanged,
                    ),
                  ),
                ),

                // Expandable Filter Drawer
                if (_showFilters)
                  SliverToBoxAdapter(
                    child: _buildFilterDrawer(context, isDark),
                  ),

                // List of Person Cards
                if (_isLoading && _people.isEmpty)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: CupertinoActivityIndicator(radius: 14),
                    ),
                  )
                else if (_people.isEmpty)
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
                            const Text(
                              'No Contacts Found',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                color: CupertinoColors.label,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _searchQuery.isNotEmpty || _hasActiveFilters
                                  ? 'No people match your active search filters.'
                                  : 'Start building your relationship engine by adding your first friend, colleague, or partner.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                              ),
                            ),
                            const SizedBox(height: 16),
                            CupertinoButton.filled(
                              onPressed: () {
                                PersonFormModal.show(
                                  context,
                                  onSuccess: _fetchData,
                                );
                              },
                              child: const Text('Add Contact'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                else
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final person = _people[index];
                        return PersonCard(
                          person: person,
                          onTap: () => _openDetail(person.slug),
                          onToggleFavorite: () => _handleToggleFavorite(person),
                          onEdit: () {
                            PersonFormModal.show(
                              context,
                              personToEdit: person,
                              onSuccess: _fetchData,
                            );
                          },
                          onDelete: () => _handleDeletePerson(person),
                        );
                      },
                      childCount: _people.length,
                    ),
                  ),

                // Bottom padding
                const SliverToBoxAdapter(
                  child: SizedBox(height: 48),
                ),
              ],
            ),

            // Top Floating Glass Island Header
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              left: 16,
              right: 16,
              child: FloatingGlassHeader(
                title: 'People',
                count: _people.length,
                pendingSyncCount: _pendingSyncCount,
                hasActiveFilters: _hasActiveFilters,
                onFilterTap: () {
                  setState(() => _showFilters = !_showFilters);
                },
                onSettingsTap: () {
                  Navigator.of(context).push(
                    CupertinoPageRoute(
                      builder: (_) => SettingsScreen(onLogout: widget.onLogout),
                    ),
                  );
                },
                onAddTap: () {
                  PersonFormModal.show(
                    context,
                    onSuccess: _fetchData,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterDrawer(BuildContext context, bool isDark) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: isDark ? const Color(0x30FFFFFF) : const Color(0x18000000),
        border: Border.all(color: isDark ? const Color(0x20FFFFFF) : const Color(0x12000000)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: Relationship Type Chips
          const Text(
            'RELATIONSHIP TYPE',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: CupertinoColors.secondaryLabel),
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 32,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              itemCount: relationshipFilterPresets.length,
              separatorBuilder: (_, _) => const SizedBox(width: 6),
              itemBuilder: (context, index) {
                final rel = relationshipFilterPresets[index];
                final isSelected = _selectedRelationship == rel;
                return GestureDetector(
                  onTap: () => _onSelectRelationship(rel),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: isSelected
                          ? const Color(0xFF8B5CF6)
                          : (isDark ? const Color(0x25FFFFFF) : const Color(0x12000000)),
                    ),
                    child: Text(
                      rel == 'all' ? 'All Types' : rel,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        color: isSelected ? CupertinoColors.white : CupertinoColors.label,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12),

          // Row 2: Birthday Month Filter Chips
          const Text(
            'BIRTHDAY MONTH',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: CupertinoColors.secondaryLabel),
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 30,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              itemCount: 12,
              separatorBuilder: (_, _) => const SizedBox(width: 6),
              itemBuilder: (context, index) {
                final monthNumber = index + 1;
                final isSelected = _selectedMonth == monthNumber;
                return GestureDetector(
                  onTap: () => _onSelectMonth(monthNumber),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: isSelected
                          ? const Color(0xFFEC4899)
                          : (isDark ? const Color(0x25FFFFFF) : const Color(0x12000000)),
                    ),
                    child: Text(
                      monthNames[index],
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        color: isSelected ? CupertinoColors.white : CupertinoColors.label,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12),

          // Row 3: Action Buttons (Favorites toggle, Sort sheet, Clear)
          Row(
            children: [
              // Favorites Toggle Pill
              GestureDetector(
                onTap: _toggleFavoriteFilter,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: _favoriteOnly
                        ? const Color(0xFFF59E0B)
                        : (isDark ? const Color(0x25FFFFFF) : const Color(0x12000000)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        CupertinoIcons.star_fill,
                        size: 13,
                        color: _favoriteOnly ? CupertinoColors.white : const Color(0xFFF59E0B),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Favorites',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _favoriteOnly ? CupertinoColors.white : CupertinoColors.label,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Sort Action Button
              GestureDetector(
                onTap: _showSortSheet,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: isDark ? const Color(0x25FFFFFF) : const Color(0x12000000),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(CupertinoIcons.arrow_up_arrow_down, size: 13, color: Color(0xFF8B5CF6)),
                      SizedBox(width: 4),
                      Text('Sort', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ),
              const Spacer(),

              // Clear Filters
              if (_hasActiveFilters)
                CupertinoButton(
                  padding: EdgeInsets.zero,
                  onPressed: () {
                    setState(() {
                      _selectedRelationship = 'all';
                      _selectedMonth = null;
                      _selectedVisibility = 'all';
                      _favoriteOnly = false;
                      _sortBy = 'created_desc';
                      _searchQuery = '';
                      _searchController.clear();
                    });
                    _fetchData();
                  },
                  child: const Text('Reset', style: TextStyle(fontSize: 12, color: CupertinoColors.systemRed)),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
