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

  List<PersonRecord> _people = [];
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

  void _openAddPerson() {
    HapticFeedback.lightImpact();
    PersonFormModal.show(
      context,
      onSuccess: _fetchData,
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
            final isDark = AppCupertinoTheme.isDark(context);
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
                          const Text(
                            'Filters',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: CupertinoColors.label,
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
                              });
                              _fetchData();
                            },
                            child: const Text(
                              'Done',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: AppCupertinoTheme.primaryBlue,
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
                          CupertinoListSection.insetGrouped(
                            header: const Text('FAVORITES'),
                            children: [
                              CupertinoListTile(
                                leading: const Icon(CupertinoIcons.star_fill, color: Color(0xFFF59E0B)),
                                title: const Text('Only Favorites'),
                                trailing: CupertinoSwitch(
                                  value: tempFavoriteOnly,
                                  activeTrackColor: AppCupertinoTheme.primaryBlue,
                                  onChanged: (val) {
                                    setSheetState(() => tempFavoriteOnly = val);
                                  },
                                ),
                              ),
                            ],
                          ),

                          // Section: Sort Order
                          CupertinoListSection.insetGrouped(
                            header: const Text('SORT BY'),
                            children: [
                              _buildSortTile('Recently Added', 'created_desc', tempSortBy, (v) {
                                setSheetState(() => tempSortBy = v);
                              }),
                              _buildSortTile('Recently Updated', 'updated_desc', tempSortBy, (v) {
                                setSheetState(() => tempSortBy = v);
                              }),
                              _buildSortTile('Name (A-Z)', 'name', tempSortBy, (v) {
                                setSheetState(() => tempSortBy = v);
                              }),
                              _buildSortTile('Memory Score', 'memory_score', tempSortBy, (v) {
                                setSheetState(() => tempSortBy = v);
                              }),
                            ],
                          ),

                          // Section: Relationship
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                            child: Text(
                              'RELATIONSHIP',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: relationshipFilterPresets.map((rel) {
                                final isSelected = tempRelationship == rel;
                                return GestureDetector(
                                  onTap: () {
                                    HapticFeedback.selectionClick();
                                    setSheetState(() => tempRelationship = rel);
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? AppCupertinoTheme.primaryBlue
                                          : AppCupertinoTheme.cardBackground.resolveFrom(context),
                                      borderRadius: BorderRadius.circular(18),
                                      border: Border.all(
                                        color: isSelected
                                            ? AppCupertinoTheme.primaryBlue
                                            : AppCupertinoTheme.cardBorder.resolveFrom(context),
                                        width: 0.8,
                                      ),
                                    ),
                                    child: Text(
                                      rel == 'all' ? 'All' : rel,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                                        color: isSelected
                                            ? CupertinoColors.white
                                            : CupertinoColors.label,
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
                                color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
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
                                          ? AppCupertinoTheme.primaryBlue
                                          : AppCupertinoTheme.cardBackground.resolveFrom(context),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: isSelected
                                            ? AppCupertinoTheme.primaryBlue
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
                                            : CupertinoColors.label,
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
                              'PRIVACY / VISIBILITY',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            child: SizedBox(
                              width: double.infinity,
                              child: CupertinoSegmentedControl<String>(
                                groupValue: tempVisibility,
                                selectedColor: AppCupertinoTheme.primaryBlue,
                                unselectedColor: AppCupertinoTheme.cardBackground.resolveFrom(context),
                                borderColor: AppCupertinoTheme.cardBorder.resolveFrom(context),
                                children: const {
                                  'all': Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Text('All')),
                                  'public': Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Text('Public')),
                                  'unlisted': Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Text('Unlisted')),
                                  'private': Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Text('Private')),
                                },
                                onValueChanged: (val) {
                                  HapticFeedback.selectionClick();
                                  setSheetState(() => tempVisibility = val);
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

  Widget _buildSortTile(String title, String value, String currentVal, ValueChanged<String> onSelect) {
    final isSelected = currentVal == value;
    return CupertinoListTile(
      title: Text(title),
      trailing: isSelected
          ? const Icon(CupertinoIcons.checkmark, color: AppCupertinoTheme.primaryBlue, size: 18)
          : null,
      onTap: () {
        HapticFeedback.selectionClick();
        onSelect(value);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = AppCupertinoTheme.isDark(context);

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
            // Pull-to-refresh
            CupertinoSliverRefreshControl(
              onRefresh: () async {
                await SyncService.processQueue();
                await _fetchData();
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
                          const Text(
                            'People',
                            style: TextStyle(
                              fontSize: 34,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -1.0,
                              color: CupertinoColors.label,
                              height: 1.15,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            _people.isNotEmpty
                                ? '${_people.length} ${_people.length == 1 ? 'person' : 'people'} in your circle${_pendingSyncCount > 0 ? ' • $_pendingSyncCount pending sync' : ''}'
                                : (_isLoading ? 'Loading circle...' : '0 people in your circle'),
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w400,
                              letterSpacing: -0.2,
                              color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
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
                          gradient: const LinearGradient(
                            colors: [Color(0xFF007AFF), Color(0xFF6366F1)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF007AFF).withValues(alpha: 0.32),
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
                                  color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                                ),
                                style: const TextStyle(
                                  fontSize: 15,
                                  color: CupertinoColors.label,
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
                              ? AppCupertinoTheme.primaryBlue.withValues(alpha: 0.12)
                              : AppCupertinoTheme.subtleFill.resolveFrom(context),
                          borderRadius: BorderRadius.circular(14),
                          border: _hasActiveFilters
                              ? Border.all(color: AppCupertinoTheme.primaryBlue, width: 1.2)
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: Icon(
                          CupertinoIcons.slider_horizontal_3,
                          size: 20,
                          color: _hasActiveFilters
                              ? AppCupertinoTheme.primaryBlue
                              : CupertinoColors.label,
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
                  onItemTap: (item) => _openDetail(item.personId),
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
                    const Text(
                      'Your people',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5,
                        color: CupertinoColors.label,
                      ),
                    ),
                    GestureDetector(
                      onTap: () => _showFilterSheet(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: _hasActiveFilters
                              ? AppCupertinoTheme.primaryBlue.withValues(alpha: 0.12)
                              : AppCupertinoTheme.subtleFill.resolveFrom(context),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _hasActiveFilters
                                ? AppCupertinoTheme.primaryBlue
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
                                  ? AppCupertinoTheme.primaryBlue
                                  : CupertinoColors.label,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Filter',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: _hasActiveFilters
                                    ? AppCupertinoTheme.primaryBlue
                                    : CupertinoColors.label,
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
                              : 'Start building your circle by adding your first friend, classmate, or partner.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
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
                      itemCount: _people.length,
                      itemBuilder: (context, index) {
                        final person = _people[index];
                        final isLast = index == _people.length - 1;
                        return PersonCard(
                          person: person,
                          showDivider: !isLast,
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
