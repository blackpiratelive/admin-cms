import 'dart:async';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/models/microblog_post.dart';
import '../core/network/api_service.dart';
import '../core/storage/local_store.dart';
import '../widgets/microblog_card.dart';
import 'compose_modal.dart';
import 'settings_screen.dart';

class TimelineScreen extends StatefulWidget {
  final VoidCallback onLogout;

  const TimelineScreen({
    super.key,
    required this.onLogout,
  });

  @override
  State<TimelineScreen> createState() => _TimelineScreenState();
}

class _TimelineScreenState extends State<TimelineScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  List<MicroblogPost> _posts = [];
  int _totalCount = 0;
  int _currentPage = 1;
  int _totalPages = 1;

  String _searchQuery = '';
  String _statusFilter = 'all'; // 'all', 'published', 'draft'

  bool _isLoading = false;
  bool _isLoadingMore = false;
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    _loadCachedDataFirst();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadCachedDataFirst() async {
    final cached = await LocalStore.getCachedPosts();
    if (cached.isNotEmpty && mounted) {
      setState(() {
        _posts = cached;
        _totalCount = cached.length;
      });
    }
    _fetchData(refresh: true);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      if (!_isLoading && !_isLoadingMore && _currentPage < _totalPages) {
        _loadMore();
      }
    }
  }

  Future<void> _fetchData({bool refresh = false}) async {
    if (_isLoading) return;

    if (refresh) {
      _currentPage = 1;
    }

    setState(() => _isLoading = _posts.isEmpty);

    try {
      final res = await ApiService.getPosts(
        search: _searchQuery,
        status: _statusFilter,
        page: _currentPage,
        limit: 25,
      );

      if (mounted) {
        setState(() {
          if (refresh) {
            _posts = res.items;
          } else {
            _posts.addAll(res.items);
          }
          _totalCount = res.total;
          _totalPages = res.totalPages;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || _currentPage >= _totalPages) return;

    setState(() => _isLoadingMore = true);
    final nextPage = _currentPage + 1;

    try {
      final res = await ApiService.getPosts(
        search: _searchQuery,
        status: _statusFilter,
        page: nextPage,
        limit: 25,
      );

      if (mounted) {
        setState(() {
          _currentPage = nextPage;
          _posts.addAll(res.items);
          _isLoadingMore = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingMore = false);
      }
    }
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 350), () {
      if (mounted) {
        setState(() {
          _searchQuery = query;
        });
        _fetchData(refresh: true);
      }
    });
  }

  void _onFilterChanged(String? filter) {
    if (filter != null && filter != _statusFilter) {
      setState(() {
        _statusFilter = filter;
      });
      HapticFeedback.selectionClick();
      _fetchData(refresh: true);
    }
  }

  Future<void> _togglePostStatus(MicroblogPost post) async {
    final nextStatus = post.isPublished ? 'draft' : 'published';
    HapticFeedback.mediumImpact();

    try {
      final updated = post.copyWith(
        status: nextStatus,
        publishedAt: nextStatus == 'published' ? DateTime.now() : null,
      );

      await ApiService.savePost(updated.toJson());

      setState(() {
        final index = _posts.indexWhere((p) => p.id == post.id);
        if (index != -1) {
          _posts[index] = updated;
        }
      });
    } catch (e) {
      _showErrorAlert('Status Update Failed', e.toString());
    }
  }

  Future<void> _deletePost(MicroblogPost post) async {
    HapticFeedback.mediumImpact();

    try {
      final success = await ApiService.deletePost(post.id);
      if (success && mounted) {
        setState(() {
          _posts.removeWhere((p) => p.id == post.id);
          _totalCount = (_totalCount - 1).clamp(0, 999999);
        });
      }
    } catch (e) {
      _showErrorAlert('Delete Failed', e.toString());
    }
  }

  void _openComposer({MicroblogPost? editPost}) {
    HapticFeedback.lightImpact();
    ComposeModal.show(
      context,
      editPost: editPost,
      onSaved: () => _fetchData(refresh: true),
    );
  }

  void _openSettings() {
    HapticFeedback.lightImpact();
    Navigator.of(context).push(
      CupertinoPageRoute(
        builder: (_) => SettingsScreen(onLogout: widget.onLogout),
      ),
    );
  }

  void _showErrorAlert(String title, String message) {
    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          CupertinoDialogAction(
            child: const Text('OK'),
            onPressed: () => Navigator.of(ctx).pop(),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: CupertinoColors.systemGroupedBackground,
      child: CustomScrollView(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        slivers: [
          // Cupertino Collapsing Navigation Bar
          CupertinoSliverNavigationBar(
            largeTitle: Text(
              _totalCount > 0 ? 'Microblog ($_totalCount)' : 'Microblog',
            ),
            leading: CupertinoButton(
              padding: EdgeInsets.zero,
              onPressed: _openSettings,
              child: const Icon(CupertinoIcons.gear, size: 22),
            ),
            trailing: CupertinoButton(
              padding: EdgeInsets.zero,
              onPressed: () => _openComposer(),
              child: const Icon(CupertinoIcons.add, size: 26),
            ),
          ),

          // Pull to Refresh
          CupertinoSliverRefreshControl(
            onRefresh: () => _fetchData(refresh: true),
          ),

          // Search & Segmented Filter Toolbar
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Column(
                children: [
                  // Search Bar
                  CupertinoSearchTextField(
                    controller: _searchController,
                    placeholder: 'Search microblogs...',
                    onChanged: _onSearchChanged,
                    onSuffixTap: () {
                      _searchController.clear();
                      _onSearchChanged('');
                    },
                  ),
                  const SizedBox(height: 12),

                  // Segmented Status Filter
                  SizedBox(
                    width: double.infinity,
                    child: CupertinoSlidingSegmentedControl<String>(
                      groupValue: _statusFilter,
                      children: const {
                        'all': Padding(
                          padding: EdgeInsets.symmetric(vertical: 6),
                          child: Text('All'),
                        ),
                        'published': Padding(
                          padding: EdgeInsets.symmetric(vertical: 6),
                          child: Text('Published'),
                        ),
                        'draft': Padding(
                          padding: EdgeInsets.symmetric(vertical: 6),
                          child: Text('Drafts'),
                        ),
                      },
                      onValueChanged: _onFilterChanged,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Content List
          if (_isLoading && _posts.isEmpty)
            const SliverFillRemaining(
              child: Center(
                child: CupertinoActivityIndicator(radius: 14),
              ),
            )
          else if (_posts.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      CupertinoIcons.chat_bubble_text,
                      size: 56,
                      color: CupertinoColors.secondaryLabel.resolveFrom(context),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _searchQuery.isNotEmpty
                          ? 'No posts match "$_searchQuery"'
                          : 'No microblog posts found',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        color: CupertinoColors.secondaryLabel.resolveFrom(context),
                      ),
                    ),
                    const SizedBox(height: 16),
                    CupertinoButton(
                      onPressed: () => _openComposer(),
                      child: const Text('Write Your First Post'),
                    ),
                  ],
                ),
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final post = _posts[index];
                  return MicroblogCard(
                    post: post,
                    onEdit: () => _openComposer(editPost: post),
                    onToggleStatus: () => _togglePostStatus(post),
                    onDelete: () => _deletePost(post),
                  );
                },
                childCount: _posts.length,
              ),
            ),

          // Bottom Loading Indicator for Pagination
          if (_isLoadingMore)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CupertinoActivityIndicator()),
              ),
            )
          else
            const SliverToBoxAdapter(
              child: SizedBox(height: 32),
            ),
        ],
      ),
    );
  }
}
