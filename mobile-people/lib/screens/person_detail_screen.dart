import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/models/person_record.dart';
import '../core/models/person_connections.dart';
import '../core/models/person_timeline_item.dart';
import '../core/network/api_service.dart';
import '../core/network/sync_service.dart';
import '../core/theme/cupertino_theme.dart';
import '../widgets/image_lightbox.dart';
import 'person_form_modal.dart';
import 'connect_entity_modal.dart';

class PersonDetailScreen extends StatefulWidget {
  final String personIdOrSlug;
  final VoidCallback? onPersonChanged;

  const PersonDetailScreen({
    super.key,
    required this.personIdOrSlug,
    this.onPersonChanged,
  });

  @override
  State<PersonDetailScreen> createState() => _PersonDetailScreenState();
}

class _PersonDetailScreenState extends State<PersonDetailScreen> {
  PersonRecord? _person;
  PersonConnections _connections = const PersonConnections();
  List<PersonTimelineItem> _timeline = [];

  bool _isLoading = true;
  int _activeTabIndex = 0; // 0: Overview, 1: Connections, 2: Timeline

  @override
  void initState() {
    super.initState();
    _loadPersonDetail();
  }

  Future<void> _loadPersonDetail() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getPersonDetail(widget.personIdOrSlug);
      if (res != null && mounted) {
        setState(() {
          _person = res.person;
          _connections = res.connections;
          _timeline = res.timeline;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleToggleFavorite() async {
    if (_person == null) return;
    HapticFeedback.lightImpact();

    final newFav = !_person!.favorite;
    setState(() {
      _person = _person!.copyWith(favorite: newFav);
    });

    try {
      await ApiService.toggleFavorite(_person!.id);
      widget.onPersonChanged?.call();
    } catch (_) {
      await SyncService.queueMutation(
        type: 'toggle_favorite',
        entityId: _person!.id,
        payload: {'favorite': newFav},
      );
      widget.onPersonChanged?.call();
    }
  }

  Future<void> _handleDeletePerson() async {
    if (_person == null) return;

    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Delete Contact'),
        content: Text('Are you sure you want to delete ${_person!.displayName}? All connections will be removed.'),
        actions: [
          CupertinoDialogAction(
            child: const Text('Cancel'),
            onPressed: () => Navigator.of(ctx).pop(),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            child: const Text('Delete'),
            onPressed: () async {
              Navigator.of(ctx).pop();
              try {
                await ApiService.deletePerson(_person!.id);
              } catch (_) {
                await SyncService.queueMutation(
                  type: 'delete_person',
                  entityId: _person!.id,
                  payload: {},
                );
              }
              widget.onPersonChanged?.call();
              if (mounted) Navigator.of(context).pop();
            },
          ),
        ],
      ),
    );
  }

  Future<void> _handleRemoveConnection(String? relationshipId) async {
    if (relationshipId == null || _person == null) return;
    HapticFeedback.mediumImpact();

    try {
      await ApiService.removeConnection(
        personId: _person!.id,
        relationshipId: relationshipId,
      );
      _loadPersonDetail();
      widget.onPersonChanged?.call();
    } catch (_) {
      await SyncService.queueMutation(
        type: 'remove_connection',
        entityId: _person!.id,
        payload: {'relationshipId': relationshipId},
      );
      _loadPersonDetail();
      widget.onPersonChanged?.call();
    }
  }

  Future<void> _launchUrlString(String url) async {
    if (url.isEmpty) return;
    final uri = Uri.parse(url);
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final isDark = AppCupertinoTheme.isDark(context);

    if (_isLoading && _person == null) {
      return CupertinoPageScaffold(
        navigationBar: const CupertinoNavigationBar(middle: Text('Loading...')),
        child: const Center(child: CupertinoActivityIndicator(radius: 14)),
      );
    }

    if (_person == null) {
      return CupertinoPageScaffold(
        navigationBar: const CupertinoNavigationBar(middle: Text('Person Not Found')),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(CupertinoIcons.person_crop_circle_badge_exclam, size: 48, color: CupertinoColors.systemGrey),
              const SizedBox(height: 12),
              const Text('Contact profile could not be loaded.'),
              const SizedBox(height: 16),
              CupertinoButton.filled(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Go Back'),
              ),
            ],
          ),
        ),
      );
    }

    final p = _person!;

    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: Text(p.displayName),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CupertinoButton(
              padding: EdgeInsets.zero,
              onPressed: _handleToggleFavorite,
              child: Icon(
                p.favorite ? CupertinoIcons.star_fill : CupertinoIcons.star,
                color: p.favorite ? const Color(0xFFF59E0B) : CupertinoColors.systemGrey,
                size: 20,
              ),
            ),
            const SizedBox(width: 8),
            CupertinoButton(
              padding: EdgeInsets.zero,
              onPressed: () {
                PersonFormModal.show(
                  context,
                  personToEdit: p,
                  onSuccess: () {
                    _loadPersonDetail();
                    widget.onPersonChanged?.call();
                  },
                );
              },
              child: const Icon(CupertinoIcons.pencil, size: 20),
            ),
            const SizedBox(width: 4),
            CupertinoButton(
              padding: EdgeInsets.zero,
              onPressed: _handleDeletePerson,
              child: const Icon(CupertinoIcons.trash, color: CupertinoColors.systemRed, size: 20),
            ),
          ],
        ),
      ),
      child: SafeArea(
        child: ListView(
            padding: const EdgeInsets.only(bottom: 32),
            children: [
              // Hero Profile Banner
              _buildHeroCard(context, p, isDark),

              // Segmented Tabs Switcher
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: CupertinoSlidingSegmentedControl<int>(
                  groupValue: _activeTabIndex,
                  onValueChanged: (val) {
                    if (val != null) setState(() => _activeTabIndex = val);
                  },
                  children: {
                    0: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 6),
                      child: Text('Overview', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
                    1: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text('Connections', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          if (_connections.totalCount > 0) ...[
                            const SizedBox(width: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(8),
                                color: isDark ? const Color(0x35FFFFFF) : const Color(0x20000000),
                              ),
                              child: Text(
                                _connections.totalCount.toString(),
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    2: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 6),
                      child: Text('Timeline', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
                  },
                ),
              ),

              // TAB 0: OVERVIEW & NOTES
              if (_activeTabIndex == 0) ...[
                _buildOverviewTab(context, p, isDark),
              ],

              // TAB 1: CONNECTIONS HUB
              if (_activeTabIndex == 1) ...[
                _buildConnectionsTab(context, p, isDark),
              ],

              // TAB 2: MEMORY TIMELINE
              if (_activeTabIndex == 2) ...[
                _buildTimelineTab(context, p, isDark),
              ],
            ],
          ),
        ),
    );
  }

  Widget _buildCard({
    required BuildContext context,
    required Widget child,
    EdgeInsetsGeometry padding = const EdgeInsets.all(16),
  }) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: AppCupertinoTheme.cardBackground.resolveFrom(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppCupertinoTheme.cardBorder.resolveFrom(context),
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: CupertinoColors.systemGrey5.resolveFrom(context).withValues(alpha: 0.3),
            offset: const Offset(0, 2),
            blurRadius: 8,
          ),
        ],
      ),
      child: child,
    );
  }

  Color _getCountdownColor(int days) {
    if (days == 0) return CupertinoColors.systemRed;
    if (days == 1) return CupertinoColors.systemOrange;
    if (days <= 7) return const Color(0xFFF59E0B);
    return CupertinoColors.systemGreen;
  }

  Widget _buildHeroCard(BuildContext context, PersonRecord p, bool isDark) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppCupertinoTheme.cardBackground.resolveFrom(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppCupertinoTheme.cardBorder.resolveFrom(context),
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: CupertinoColors.systemGrey5.resolveFrom(context).withValues(alpha: 0.3),
            offset: const Offset(0, 2),
            blurRadius: 8,
          ),
        ],
      ),
      child: Column(
          children: [
            Row(
              children: [
                // Avatar
                if (p.hasAvatar)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(35),
                    child: CachedNetworkImage(
                      imageUrl: p.avatarUrl!,
                      width: 70,
                      height: 70,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => _initialsAvatar(p, 70, 24),
                    ),
                  )
                else
                  _initialsAvatar(p, 70, 24),

                const SizedBox(width: 16),

                // Name, Nickname, Relationship, Visibility
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              p.displayName,
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.4,
                                color: AppCupertinoTheme.label(context),
                              ),
                            ),
                          ),
                          if (p.nickname != null && p.nickname!.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Text(
                              '"${p.nickname}"',
                              style: TextStyle(
                                fontSize: 14,
                                fontStyle: FontStyle.italic,
                                color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 6),

                      // Relationship badge + Visibility
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.16),
                              border: Border.all(
                                color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.35),
                                width: 0.8,
                              ),
                            ),
                            child: Text(
                              p.relationshipType,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppCupertinoTheme.brandAccent,
                              ),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              color: isDark ? const Color(0x25FFFFFF) : const Color(0x15000000),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  p.visibility == 'public'
                                      ? CupertinoIcons.globe
                                      : p.visibility == 'unlisted'
                                          ? CupertinoIcons.eye_slash
                                          : CupertinoIcons.lock,
                                  size: 11,
                                  color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                                ),
                                const SizedBox(width: 3),
                                Text(
                                  p.visibility,
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),

                      if (p.fullName != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Full Name: ${p.fullName}',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),

            // Social links row
            if (p.socialLinks.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(height: 0.5, color: isDark ? const Color(0x20FFFFFF) : const Color(0x15000000)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (p.socialLinks.instagram != null)
                    _socialChip(
                      label: 'Instagram',
                      icon: CupertinoIcons.camera,
                      color: const Color(0xFFEC4899),
                      onTap: () => _launchUrlString(p.socialLinks.getInstagramUrl()),
                      isDark: isDark,
                    ),
                  if (p.socialLinks.facebook != null)
                    _socialChip(
                      label: 'Facebook',
                      icon: CupertinoIcons.person_2,
                      color: const Color(0xFF1877F2),
                      onTap: () => _launchUrlString(p.socialLinks.getFacebookUrl()),
                      isDark: isDark,
                    ),
                  if (p.socialLinks.github != null)
                    _socialChip(
                      label: 'GitHub',
                      icon: CupertinoIcons.chevron_left_slash_chevron_right,
                      color: isDark ? CupertinoColors.white : CupertinoColors.black,
                      onTap: () => _launchUrlString(p.socialLinks.getGithubUrl()),
                      isDark: isDark,
                    ),
                  if (p.socialLinks.linkedin != null)
                    _socialChip(
                      label: 'LinkedIn',
                      icon: CupertinoIcons.briefcase,
                      color: const Color(0xFF0A66C2),
                      onTap: () => _launchUrlString(p.socialLinks.getLinkedinUrl()),
                      isDark: isDark,
                    ),
                  if (p.socialLinks.website != null)
                    _socialChip(
                      label: 'Website',
                      icon: CupertinoIcons.globe,
                      color: const Color(0xFF007AFF),
                      onTap: () => _launchUrlString(p.socialLinks.getWebsiteUrl()),
                      isDark: isDark,
                    ),
                ],
              ),
            ],
          ],
        ),
    );
  }

  Widget _socialChip({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
    required bool isDark,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: isDark ? const Color(0x30FFFFFF) : const Color(0x18000000),
          border: Border.all(color: isDark ? const Color(0x20FFFFFF) : const Color(0x12000000)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppCupertinoTheme.label(context)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOverviewTab(BuildContext context, PersonRecord p, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Personal Notes
          _buildCard(
            context: context,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(CupertinoIcons.doc_text, size: 16, color: Color(0xFF8B5CF6)),
                    const SizedBox(width: 6),
                    Text(
                      'Personal Notes & Memories',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppCupertinoTheme.label(context)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (p.notesMarkdown != null && p.notesMarkdown!.trim().isNotEmpty)
                  MarkdownBody(
                    data: p.notesMarkdown!,
                    styleSheet: MarkdownStyleSheet.fromCupertinoTheme(CupertinoTheme.of(context)),
                  )
                else
                  Text(
                    'No notes recorded yet. Tap edit to write gift ideas, stories, or thoughts.',
                    style: TextStyle(
                      fontStyle: FontStyle.italic,
                      fontSize: 13,
                      color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Interests Tag Cloud
          _buildCard(
            context: context,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(CupertinoIcons.tag, size: 16, color: Color(0xFFEC4899)),
                    const SizedBox(width: 6),
                    Text(
                      'Interests & Shared Topics',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppCupertinoTheme.label(context)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (p.interests.isNotEmpty)
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: p.interests.map((interest) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: const Color(0xFFEC4899).withValues(alpha: 0.15),
                          border: Border.all(color: const Color(0xFFEC4899).withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          '#$interest',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFEC4899)),
                        ),
                      );
                    }).toList(),
                  )
                else
                  Text(
                    'No interests tagged yet.',
                    style: TextStyle(fontSize: 13, color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Important Dates
          _buildCard(
            context: context,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(CupertinoIcons.calendar, size: 16, color: Color(0xFFF59E0B)),
                    const SizedBox(width: 6),
                    Text(
                      'Important Dates',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppCupertinoTheme.label(context)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (p.importantDates.isNotEmpty)
                  Column(
                    children: p.importantDates.map((d) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: _getCountdownColor(d.daysRemaining),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    d.title,
                                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppCupertinoTheme.label(context)),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${d.date} (${d.countdownBadge})',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                                    ),
                                  ),
                                  if (d.notes != null && d.notes!.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      d.notes!,
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontStyle: FontStyle.italic,
                                        color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            if (d.reminderEnabled)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(6),
                                  color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(CupertinoIcons.bell_fill, size: 10, color: Color(0xFF8B5CF6)),
                                    SizedBox(width: 3),
                                    Text('Reminder', style: TextStyle(fontSize: 10, color: Color(0xFF8B5CF6), fontWeight: FontWeight.w600)),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      );
                    }).toList(),
                  )
                else
                  Text(
                    'No important dates recorded.',
                    style: TextStyle(fontSize: 13, color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConnectionsTab(BuildContext context, PersonRecord p, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Connect Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Connections (${_connections.totalCount})',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppCupertinoTheme.label(context)),
              ),
              CupertinoButton(
                padding: EdgeInsets.zero,
                onPressed: () {
                  ConnectEntityModal.show(
                    context,
                    person: p,
                    onSuccess: () {
                      _loadPersonDetail();
                      widget.onPersonChanged?.call();
                    },
                  );
                },
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(CupertinoIcons.plus_circle, size: 16),
                    SizedBox(width: 4),
                    Text('Connect Item', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // 1. Photos
          _buildConnectionSection(
            title: 'Photos Together (${_connections.photos.length})',
            icon: CupertinoIcons.photo,
            color: const Color(0xFF06B6D4),
            child: _connections.photos.isEmpty
                ? _emptyNotice('No photos linked yet.')
                : GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                    ),
                    itemCount: _connections.photos.length,
                    itemBuilder: (context, idx) {
                      final photo = _connections.photos[idx];
                      final allUrls = _connections.photos.map((ph) => ph.displayUrl).toList();
                      return Stack(
                        fit: StackFit.expand,
                        children: [
                          GestureDetector(
                            onTap: () => ImageLightbox.show(context, allUrls, initialIndex: idx),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: CachedNetworkImage(
                                imageUrl: photo.displayUrl,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: GestureDetector(
                              onTap: () => _handleRemoveConnection(photo.relationshipId),
                              child: Container(
                                padding: const EdgeInsets.all(3),
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Color(0x99000000),
                                ),
                                child: const Icon(CupertinoIcons.clear, color: CupertinoColors.white, size: 12),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
          ),
          const SizedBox(height: 12),

          // 2. Locations
          _buildConnectionSection(
            title: 'Places Visited Together (${_connections.locations.length})',
            icon: CupertinoIcons.location_solid,
            color: const Color(0xFF10B981),
            child: _connections.locations.isEmpty
                ? _emptyNotice('No places linked yet.')
                : Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _connections.locations.map((loc) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          color: isDark ? const Color(0x25FFFFFF) : const Color(0x12000000),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              loc.name,
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppCupertinoTheme.label(context)),
                            ),
                            if (loc.subtitle.isNotEmpty) ...[
                              const SizedBox(width: 4),
                              Text(
                                '(${loc.subtitle})',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                                ),
                              ),
                            ],
                            const SizedBox(width: 6),
                            GestureDetector(
                              onTap: () => _handleRemoveConnection(loc.relationshipId),
                              child: const Icon(CupertinoIcons.clear_circled, size: 14, color: CupertinoColors.systemRed),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
          ),
          const SizedBox(height: 12),

          // 3. Shared Trips
          _buildConnectionSection(
            title: 'Shared Trips (${_connections.trips.length})',
            icon: CupertinoIcons.airplane,
            color: const Color(0xFF8B5CF6),
            child: _connections.trips.isEmpty
                ? _emptyNotice('No trips linked yet.')
                : Column(
                    children: _connections.trips.map((t) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          color: isDark ? const Color(0x25FFFFFF) : const Color(0x12000000),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              t.title,
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppCupertinoTheme.label(context)),
                            ),
                            GestureDetector(
                              onTap: () => _handleRemoveConnection(t.relationshipId),
                              child: const Icon(CupertinoIcons.clear_circled, size: 14, color: CupertinoColors.systemRed),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
          ),
          const SizedBox(height: 12),

          // 4. Microblogs & Projects
          _buildConnectionSection(
            title: 'Mentions in Microblogs (${_connections.microblogs.length})',
            icon: CupertinoIcons.chat_bubble_text,
            color: const Color(0xFF3B82F6),
            child: _connections.microblogs.isEmpty
                ? _emptyNotice('No microblogs linked.')
                : Column(
                    children: _connections.microblogs.map((mb) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          color: isDark ? const Color(0x25FFFFFF) : const Color(0x12000000),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                mb.contentMarkdown,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12, color: AppCupertinoTheme.label(context)),
                              ),
                            ),
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: () => _handleRemoveConnection(mb.relationshipId),
                              child: const Icon(CupertinoIcons.clear_circled, size: 14, color: CupertinoColors.systemRed),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimelineTab(BuildContext context, PersonRecord p, bool isDark) {
    if (_timeline.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(32),
        child: Center(
          child: Text(
            'No timeline items recorded yet. Link photos, trips, or add dates to build the relationship story.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: _buildCard(
        context: context,
        child: Column(
          children: _timeline.asMap().entries.map((entry) {
            final idx = entry.key;
            final item = entry.value;
            final isLast = idx == _timeline.length - 1;

            return IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Timeline Node Line + Circle
                  Column(
                    children: [
                      Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: item.nodeColor,
                        ),
                      ),
                      if (!isLast)
                        Expanded(
                          child: Container(
                            width: 2,
                            color: isDark ? const Color(0x30FFFFFF) : const Color(0x20000000),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 12),

                  // Node content
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                item.date,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(4),
                                  color: item.nodeColor.withValues(alpha: 0.15),
                                ),
                                child: Text(
                                  item.type.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    color: item.nodeColor,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.title,
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppCupertinoTheme.label(context)),
                          ),
                          if (item.description != null && item.description!.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              item.description!,
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                              ),
                            ),
                          ],
                          if (item.thumbnailUrl != null) ...[
                            const SizedBox(height: 6),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: CachedNetworkImage(
                                imageUrl: item.thumbnailUrl!,
                                width: 90,
                                height: 90,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildConnectionSection({
    required String title,
    required IconData icon,
    required Color color,
    required Widget child,
  }) {
    return _buildCard(
      context: context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(
                title,
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppCupertinoTheme.label(context)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _emptyNotice(String message) {
    return Text(
      message,
      style: TextStyle(fontSize: 12, color: AppCupertinoTheme.secondary(context)),
    );
  }

  Widget _initialsAvatar(PersonRecord p, double size, double fontSize) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: AppCupertinoTheme.brandGradient,
      ),
      alignment: Alignment.center,
      child: Text(
        p.initials,
        style: TextStyle(
          color: CupertinoColors.white,
          fontSize: fontSize,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
