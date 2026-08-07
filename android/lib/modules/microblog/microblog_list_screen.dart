import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import '../../core/models/microblog.dart';
import '../../core/network/api_client.dart';
import '../../shared/widgets/toast_notification.dart';
import 'widgets/status_badge.dart';

class MicroblogListScreen extends StatefulWidget {
  final String activeThemeKey;
  final Function(String? editId) onOpenEditor;

  const MicroblogListScreen({
    super.key,
    required this.activeThemeKey,
    required this.onOpenEditor,
  });

  @override
  State<MicroblogListScreen> createState() => _MicroblogListScreenState();
}

class _MicroblogListScreenState extends State<MicroblogListScreen> {
  final TextEditingController _searchController = TextEditingController();

  List<Microblog> _items = [];
  int _totalItems = 0;
  int _totalPages = 1;

  String _search = '';
  String _statusFilter = 'all';
  int _currentPage = 1;
  int _pageSize = 50;

  bool _isFetching = false;
  bool _isDeleting = false;
  final Set<String> _selectedIds = {};
  String? _deletingId;

  final DateFormat _dateFormat = DateFormat('MMM d, yyyy, hh:mm a');

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    if (_isFetching) return;
    setState(() => _isFetching = true);

    try {
      final res = await ApiClient.getMicroblogs(
        search: _search,
        status: _statusFilter,
        page: _currentPage,
        limit: _pageSize,
      );

      if (mounted) {
        setState(() {
          _items = res.items;
          _totalItems = res.total;
          _totalPages = res.totalPages;
        });
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(
          context,
          title: 'Error Fetching Microblogs',
          message: e.toString(),
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isFetching = false);
    }
  }

  Future<void> _handleDeleteSingle(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Microblog'),
        content: const Text('Delete this microblog entry?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _deletingId = id);
    try {
      final success = await ApiClient.deleteMicroblog(id);
      if (success) {
        _selectedIds.remove(id);
        if (mounted) {
          ToastNotification.show(context, title: 'Success', message: 'Microblog post deleted.');
        }
        _fetchData();
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(context, title: 'Delete Failed', message: e.toString(), isError: true);
      }
    } finally {
      if (mounted) setState(() => _deletingId = null);
    }
  }

  Future<void> _handleBulkDelete() async {
    if (_selectedIds.isEmpty) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Bulk Delete Microblogs'),
        content: Text('Are you sure you want to permanently delete the ${_selectedIds.length} selected microblog posts?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete Selected'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isDeleting = true);
    try {
      final success = await ApiClient.deleteMicroblogsBatch(_selectedIds.toList());
      if (success) {
        _selectedIds.clear();
        if (mounted) {
          ToastNotification.show(context, title: 'Success', message: 'Selected microblogs deleted.');
        }
        _fetchData();
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(context, title: 'Bulk Delete Failed', message: e.toString(), isError: true);
      }
    } finally {
      if (mounted) setState(() => _isDeleting = false);
    }
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null || dateStr.isEmpty) return '-';
    try {
      final dt = DateTime.parse(dateStr);
      return _dateFormat.format(dt);
    } catch (_) {
      return dateStr;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isMobile = MediaQuery.of(context).size.width < 700;

    final startIndex = _totalItems > 0 ? (_currentPage - 1) * _pageSize + 1 : 0;
    final endIndex = (_currentPage * _pageSize).clamp(0, _totalItems);
    final isAllSelected = _items.isNotEmpty && _items.every((item) => _selectedIds.contains(item.id));

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    Text('Microblog Posts ($_totalItems)', style: theme.textTheme.headlineMedium),
                    if (_isFetching) ...[
                      const SizedBox(width: 10),
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: colorScheme.primary),
                      ),
                    ],
                  ],
                ),
              ),

              if (_selectedIds.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ElevatedButton.icon(
                    onPressed: _isDeleting ? null : _handleBulkDelete,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.shade700,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    icon: _isDeleting
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(LucideIcons.trash2, size: 14),
                    label: Text('Delete Selected (${_selectedIds.length})', style: const TextStyle(fontSize: 12)),
                  ),
                ),

              ElevatedButton.icon(
                onPressed: () => widget.onOpenEditor(null),
                style: ElevatedButton.styleFrom(
                  backgroundColor: colorScheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                icon: const Icon(LucideIcons.plus, size: 16),
                label: const Text('New Microblog', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Search & Filter Toolbar
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: colorScheme.surface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
            ),
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                // Select All Checkbox
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Checkbox(
                      value: isAllSelected,
                      onChanged: (val) {
                        setState(() {
                          if (val == true) {
                            _selectedIds.addAll(_items.map((e) => e.id));
                          } else {
                            _selectedIds.removeAll(_items.map((e) => e.id));
                          }
                        });
                      },
                    ),
                    const Text('Select All', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                  ],
                ),
                // Search Input
                ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: isMobile ? double.infinity : 350),
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search microblog posts by content or slug...',
                      prefixIcon: const Icon(LucideIcons.search, size: 16),
                      isDense: true,
                    ),
                    onSubmitted: (val) {
                      setState(() {
                        _search = val;
                        _currentPage = 1;
                      });
                      _fetchData();
                    },
                  ),
                ),

                // Status Filter
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Status: ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                    DropdownButton<String>(
                      value: _statusFilter,
                      isDense: true,
                      style: TextStyle(fontSize: 12, color: colorScheme.onSurface),
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('All Statuses')),
                        DropdownMenuItem(value: 'draft', child: Text('Draft')),
                        DropdownMenuItem(value: 'published', child: Text('Published')),
                        DropdownMenuItem(value: 'scheduled', child: Text('Scheduled')),
                        DropdownMenuItem(value: 'archived', child: Text('Archived')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setState(() {
                            _statusFilter = val;
                            _currentPage = 1;
                          });
                          _fetchData();
                        }
                      },
                    ),
                  ],
                ),

                // Per Page
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Per page: ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                    DropdownButton<int>(
                      value: _pageSize,
                      isDense: true,
                      style: TextStyle(fontSize: 12, color: colorScheme.onSurface),
                      items: const [
                        DropdownMenuItem(value: 10, child: Text('10')),
                        DropdownMenuItem(value: 25, child: Text('25')),
                        DropdownMenuItem(value: 50, child: Text('50 (Default)')),
                        DropdownMenuItem(value: 100, child: Text('100')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setState(() {
                            _pageSize = val;
                            _currentPage = 1;
                          });
                          _fetchData();
                        }
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Main Data Table / Card List
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: colorScheme.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
              ),
              child: _items.isEmpty
                  ? Center(
                      child: Text(
                        _isFetching ? 'Loading microblog posts...' : 'No microblog posts found.',
                        style: TextStyle(color: colorScheme.onSurface.withValues(alpha: 0.5)),
                      ),
                    )
                  : ListView.separated(
                      itemCount: _items.length,
                      separatorBuilder: (ctx, i) => Divider(height: 1, color: colorScheme.outline.withValues(alpha: 0.15)),
                      itemBuilder: (context, index) {
                        final item = _items[index];
                        final snippet = item.contentMarkdown.length > 60
                            ? '${item.contentMarkdown.substring(0, 60)}...'
                            : item.contentMarkdown;

                        final isSelected = _selectedIds.contains(item.id);

                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          leading: Checkbox(
                            value: isSelected,
                            onChanged: (val) {
                              setState(() {
                                if (val == true) {
                                  _selectedIds.add(item.id);
                                } else {
                                  _selectedIds.remove(item.id);
                                }
                              });
                            },
                          ),
                          title: Row(
                            children: [
                              Expanded(
                                child: InkWell(
                                  onTap: () => widget.onOpenEditor(item.id),
                                  child: Text(
                                    snippet.isNotEmpty ? snippet : item.slug,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              StatusBadge(status: item.status, activeThemeKey: widget.activeThemeKey),
                            ],
                          ),
                          subtitle: Row(
                            children: [
                              Text(
                                '/${item.slug}',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  color: colorScheme.onSurface.withValues(alpha: 0.5),
                                ),
                              ),
                              const Spacer(),
                              if (!isMobile)
                                Text(
                                  _formatDate(item.publishedAt ?? item.createdAt),
                                  style: TextStyle(fontSize: 11, color: colorScheme.onSurface.withValues(alpha: 0.6)),
                                ),
                            ],
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(LucideIcons.edit3, size: 16),
                                onPressed: () => widget.onOpenEditor(item.id),
                                tooltip: 'Edit',
                              ),
                              IconButton(
                                icon: _deletingId == item.id
                                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                                    : const Icon(LucideIcons.trash2, size: 16, color: Colors.red),
                                onPressed: () => _handleDeleteSingle(item.id),
                                tooltip: 'Delete',
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ),
          const SizedBox(height: 12),

          // Pagination Footer
          Row(
            children: [
              Text(
                'Showing $startIndex to $endIndex of $_totalItems entries',
                style: TextStyle(fontSize: 12, color: colorScheme.onSurface.withValues(alpha: 0.6)),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(LucideIcons.chevronsLeft, size: 16),
                onPressed: _currentPage > 1 ? () { setState(() => _currentPage = 1); _fetchData(); } : null,
              ),
              IconButton(
                icon: const Icon(LucideIcons.chevronLeft, size: 16),
                onPressed: _currentPage > 1 ? () { setState(() => _currentPage--); _fetchData(); } : null,
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text('Page $_currentPage of $_totalPages', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
              IconButton(
                icon: const Icon(LucideIcons.chevronRight, size: 16),
                onPressed: _currentPage < _totalPages ? () { setState(() => _currentPage++); _fetchData(); } : null,
              ),
              IconButton(
                icon: const Icon(LucideIcons.chevronsRight, size: 16),
                onPressed: _currentPage < _totalPages ? () { setState(() => _currentPage = _totalPages); _fetchData(); } : null,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
