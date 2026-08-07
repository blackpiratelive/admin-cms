import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/models/microblog.dart';
import '../../core/models/location.dart';
import '../../core/models/trip.dart';
import '../../core/models/social_status.dart';
import '../../core/network/api_client.dart';
import '../../shared/widgets/toast_notification.dart';
import 'widgets/metadata_settings_panel.dart';
import 'widgets/live_markdown_preview.dart';

class MicroblogEditorScreen extends StatefulWidget {
  final String? editId;
  final String activeThemeKey;
  final VoidCallback onBackToList;

  const MicroblogEditorScreen({
    super.key,
    this.editId,
    required this.activeThemeKey,
    required this.onBackToList,
  });

  @override
  State<MicroblogEditorScreen> createState() => _MicroblogEditorScreenState();
}

class _MicroblogEditorScreenState extends State<MicroblogEditorScreen> with SingleTickerProviderStateMixin {
  final TextEditingController _contentController = TextEditingController();
  final TextEditingController _slugController = TextEditingController();
  final TextEditingController _tagsController = TextEditingController();
  final TextEditingController _coverUrlController = TextEditingController();
  final TextEditingController _shortUrlController = TextEditingController();

  String _status = 'draft';
  String? _selectedLocationId;
  String? _selectedTripId;
  DateTime? _createdAt;
  DateTime? _publishedAt;

  bool _postToBluesky = true;
  bool _postToMastodon = true;
  List<String> _images = [];

  List<LocationRecord> _locations = [];
  List<TripRecord> _trips = [];
  SocialStatus _socialStatus = SocialStatus(blueskyConnected: true, mastodonConnected: true);

  bool _isLoading = false;
  bool _isSaving = false;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _createdAt = DateTime.now();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);

    try {
      final locs = await ApiClient.getLocations();
      final trps = await ApiClient.getTrips();
      final soc = await ApiClient.getSocialStatus();

      if (mounted) {
        setState(() {
          _locations = locs;
          _trips = trps;
          _socialStatus = soc;
        });
      }

      if (widget.editId != null) {
        final result = await ApiClient.getMicroblogs(page: 1, limit: 100);
        final existing = result.items.firstWhere(
          (item) => item.id == widget.editId,
          orElse: () => Microblog(
            id: widget.editId!,
            slug: '',
            contentMarkdown: '',
            status: 'draft',
            tags: [],
            images: [],
            createdAt: DateTime.now().toIso8601String(),
            updatedAt: DateTime.now().toIso8601String(),
          ),
        );

        if (mounted) {
          setState(() {
            _contentController.text = existing.contentMarkdown;
            _slugController.text = existing.slug;
            _status = existing.status;
            _selectedLocationId = existing.locationId;
            _selectedTripId = existing.tripId;
            _tagsController.text = existing.tags.join(', ');
            _coverUrlController.text = existing.coverImageUrl ?? '';
            _shortUrlController.text = existing.shortUrl ?? '';
            _images = existing.images;
            if (existing.createdAt.isNotEmpty) _createdAt = DateTime.tryParse(existing.createdAt);
            if (existing.publishedAt != null) _publishedAt = DateTime.tryParse(existing.publishedAt!);
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(context, title: 'Error Loading Data', message: e.toString(), isError: true);
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleSave(String targetStatus) async {
    if (_contentController.text.trim().isEmpty) {
      ToastNotification.show(context, title: 'Validation Error', message: 'Post content cannot be empty.', isError: true);
      return;
    }

    setState(() {
      _isSaving = true;
      _status = targetStatus;
    });

    final tagsList = _tagsController.text
        .split(',')
        .map((t) => t.trim())
        .where((t) => t.isNotEmpty)
        .toList();

    final payload = {
      if (widget.editId != null) 'id': widget.editId,
      'slug': _slugController.text.trim(),
      'contentMarkdown': _contentController.text,
      'status': targetStatus,
      'createdAt': _createdAt?.toIso8601String(),
      'publishedAt': targetStatus == 'published' ? (_publishedAt?.toIso8601String() ?? DateTime.now().toIso8601String()) : _publishedAt?.toIso8601String(),
      'tags': tagsList,
      'coverImageUrl': _coverUrlController.text.trim().isEmpty ? null : _coverUrlController.text.trim(),
      'shortUrl': _shortUrlController.text.trim().isEmpty ? null : _shortUrlController.text.trim(),
      'locationId': _selectedLocationId,
      'tripId': _selectedTripId,
      'images': _images,
      'postToBluesky': _postToBluesky,
      'postToMastodon': _postToMastodon,
    };

    try {
      await ApiClient.saveMicroblog(payload);
      if (mounted) {
        ToastNotification.show(
          context,
          title: 'Success',
          message: targetStatus == 'published' ? 'Microblog post published!' : 'Draft saved successfully.',
        );
        widget.onBackToList();
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(context, title: 'Save Failed', message: e.toString(), isError: true);
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _handleDelete() async {
    if (widget.editId == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Post'),
        content: const Text('Are you sure you want to delete this microblog post?'),
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

    try {
      await ApiClient.deleteMicroblog(widget.editId!);
      if (mounted) {
        ToastNotification.show(context, title: 'Deleted', message: 'Post has been deleted.');
        widget.onBackToList();
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(context, title: 'Delete Failed', message: e.toString(), isError: true);
      }
    }
  }

  int get _wordCount {
    final text = _contentController.text.trim();
    if (text.isEmpty) return 0;
    return text.split(RegExp(r'\s+')).length;
  }

  int get _charCount => _contentController.text.length;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isTablet = MediaQuery.of(context).size.width >= 900;

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Header Bar Actions
          Row(
            children: [
              IconButton(
                icon: const Icon(LucideIcons.arrowLeft, size: 18),
                onPressed: widget.onBackToList,
                tooltip: 'Back to list',
              ),
              const SizedBox(width: 8),
              Icon(LucideIcons.edit3, size: 18, color: colorScheme.primary),
              const SizedBox(width: 6),
              Text(
                widget.editId != null ? 'Edit Microblog' : 'New Microblog',
                style: theme.textTheme.titleLarge,
              ),
              const SizedBox(width: 10),

              // Status Pill
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _status == 'published' ? Colors.green.withValues(alpha: 0.2) : Colors.orange.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  _status.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: _status == 'published' ? Colors.green.shade700 : Colors.orange.shade800,
                  ),
                ),
              ),

              const Spacer(),

              if (widget.editId != null)
                OutlinedButton.icon(
                  onPressed: _isSaving ? null : _handleDelete,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: BorderSide(color: Colors.red.shade300),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  icon: const Icon(LucideIcons.trash2, size: 14),
                  label: const Text('Delete', style: TextStyle(fontSize: 12)),
                ),
              const SizedBox(width: 8),

              ElevatedButton.icon(
                onPressed: _isSaving ? null : () => _handleSave('draft'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: colorScheme.surface,
                  foregroundColor: colorScheme.onSurface,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  side: BorderSide(color: colorScheme.outline.withValues(alpha: 0.3)),
                ),
                icon: const Icon(LucideIcons.save, size: 14),
                label: const Text('Save Draft', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 8),

              ElevatedButton.icon(
                onPressed: _isSaving ? null : () => _handleSave('published'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: colorScheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
                icon: _isSaving
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(LucideIcons.globe, size: 14),
                label: const Text('Publish Post', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Collapsible Settings Panel
          MetadataSettingsPanel(
            slugController: _slugController,
            status: _status,
            onStatusChanged: (val) => setState(() => _status = val),
            selectedLocationId: _selectedLocationId,
            onLocationChanged: (val) => setState(() => _selectedLocationId = val),
            selectedTripId: _selectedTripId,
            onTripChanged: (val) => setState(() => _selectedTripId = val),
            locations: _locations,
            trips: _trips,
            createdAt: _createdAt,
            onCreatedAtChanged: (val) => setState(() => _createdAt = val),
            publishedAt: _publishedAt,
            onPublishedAtChanged: (val) => setState(() => _publishedAt = val),
            tagsController: _tagsController,
            postToBluesky: _postToBluesky,
            onBlueskyChanged: (val) => setState(() => _postToBluesky = val),
            postToMastodon: _postToMastodon,
            onMastodonChanged: (val) => setState(() => _postToMastodon = val),
            socialStatus: _socialStatus,
            coverUrlController: _coverUrlController,
            images: _images,
            onImagesChanged: (val) => setState(() => _images = val),
            shortUrlController: _shortUrlController,
            onGenerateShortLink: () {
              final slug = _slugController.text.trim();
              if (slug.isNotEmpty) {
                _shortUrlController.text = 'https://link.domain/$slug';
              }
            },
          ),

          // Editor & Live Preview Area
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: colorScheme.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
              ),
              child: Column(
                children: [
                  // Tab Switcher Header (Mobile) / Telemetry Bar (Tablet)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: colorScheme.onSurface.withValues(alpha: 0.03),
                      borderRadius: const BorderRadius.only(topLeft: Radius.circular(8), topRight: Radius.circular(8)),
                      border: Border(bottom: BorderSide(color: colorScheme.outline.withValues(alpha: 0.15))),
                    ),
                    child: Row(
                      children: [
                        if (!isTablet) ...[
                          SizedBox(
                            width: 250,
                            height: 36,
                            child: TabBar(
                              controller: _tabController,
                              isScrollable: false,
                              labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                              tabs: const [
                                Tab(text: 'Write Content'),
                                Tab(text: 'Live Preview'),
                              ],
                            ),
                          ),
                        ] else ...[
                          Row(
                            children: [
                              Icon(LucideIcons.edit3, size: 14, color: colorScheme.primary),
                              const SizedBox(width: 6),
                              const Text('Write Content', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            ],
                          ),
                          const Spacer(),
                          Row(
                            children: [
                              Icon(LucideIcons.eye, size: 14, color: colorScheme.primary),
                              const SizedBox(width: 6),
                              const Text('LIVE MARKDOWN PREVIEW', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            ],
                          ),
                        ],

                        const Spacer(),

                        // Words & Chars Telemetry
                        Text(
                          'Words: $_wordCount  Chars: $_charCount',
                          style: TextStyle(fontSize: 11, fontFamily: 'monospace', color: colorScheme.onSurface.withValues(alpha: 0.6)),
                        ),
                      ],
                    ),
                  ),

                  // Content Area
                  Expanded(
                    child: isTablet
                        ? Row(
                            children: [
                              // Left: Markdown Textarea
                              Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: TextField(
                                    controller: _contentController,
                                    maxLines: null,
                                    expands: true,
                                    style: const TextStyle(fontSize: 14, height: 1.5, fontFamily: 'monospace'),
                                    decoration: const InputDecoration(
                                      hintText: 'Write your microblog content in markdown...',
                                      border: InputBorder.none,
                                      enabledBorder: InputBorder.none,
                                      focusedBorder: InputBorder.none,
                                      filled: false,
                                    ),
                                    onChanged: (val) => setState(() {}),
                                  ),
                                ),
                              ),
                              VerticalDivider(width: 1, color: colorScheme.outline.withValues(alpha: 0.2)),
                              // Right: Live Markdown Preview
                              Expanded(
                                child: SingleChildScrollView(
                                  child: LiveMarkdownPreview(markdownContent: _contentController.text),
                                ),
                              ),
                            ],
                          )
                        : TabBarView(
                            controller: _tabController,
                            children: [
                              // Write Tab
                              Padding(
                                padding: const EdgeInsets.all(12),
                                child: TextField(
                                  controller: _contentController,
                                  maxLines: null,
                                  expands: true,
                                  style: const TextStyle(fontSize: 14, height: 1.5, fontFamily: 'monospace'),
                                  decoration: const InputDecoration(
                                    hintText: 'Write your microblog content in markdown...',
                                    border: InputBorder.none,
                                    enabledBorder: InputBorder.none,
                                    focusedBorder: InputBorder.none,
                                    filled: false,
                                  ),
                                  onChanged: (val) => setState(() {}),
                                ),
                              ),
                              // Preview Tab
                              SingleChildScrollView(
                                child: LiveMarkdownPreview(markdownContent: _contentController.text),
                              ),
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
