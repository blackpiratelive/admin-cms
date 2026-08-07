import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/models/location.dart';
import '../../../core/models/trip.dart';
import '../../../core/models/social_status.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/widgets/toast_notification.dart';

class MetadataSettingsPanel extends StatefulWidget {
  final TextEditingController slugController;
  final String status;
  final ValueChanged<String> onStatusChanged;
  final String? selectedLocationId;
  final ValueChanged<String?> onLocationChanged;
  final String? selectedTripId;
  final ValueChanged<String?> onTripChanged;
  final List<LocationRecord> locations;
  final List<TripRecord> trips;
  final DateTime? createdAt;
  final ValueChanged<DateTime> onCreatedAtChanged;
  final DateTime? publishedAt;
  final ValueChanged<DateTime?> onPublishedAtChanged;
  final TextEditingController tagsController;
  final bool postToBluesky;
  final ValueChanged<bool> onBlueskyChanged;
  final bool postToMastodon;
  final ValueChanged<bool> onMastodonChanged;
  final SocialStatus socialStatus;
  final TextEditingController coverUrlController;
  final List<String> images;
  final ValueChanged<List<String>> onImagesChanged;
  final TextEditingController shortUrlController;
  final VoidCallback onGenerateShortLink;

  const MetadataSettingsPanel({
    super.key,
    required this.slugController,
    required this.status,
    required this.onStatusChanged,
    required this.selectedLocationId,
    required this.onLocationChanged,
    required this.selectedTripId,
    required this.onTripChanged,
    required this.locations,
    required this.trips,
    required this.createdAt,
    required this.onCreatedAtChanged,
    required this.publishedAt,
    required this.onPublishedAtChanged,
    required this.tagsController,
    required this.postToBluesky,
    required this.onBlueskyChanged,
    required this.postToMastodon,
    required this.onMastodonChanged,
    required this.socialStatus,
    required this.coverUrlController,
    required this.images,
    required this.onImagesChanged,
    required this.shortUrlController,
    required this.onGenerateShortLink,
  });

  @override
  State<MetadataSettingsPanel> createState() => _MetadataSettingsPanelState();
}

class _MetadataSettingsPanelState extends State<MetadataSettingsPanel> {
  bool _isCollapsed = true;
  String _activeTab = 'general';
  bool _isUploadingImage = false;

  Future<void> _pickAndUploadImage() async {
    try {
      final picker = ImagePicker();
      final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (file == null) return;

      setState(() => _isUploadingImage = true);
      final bytes = await file.readAsBytes();
      final url = await ApiClient.uploadImage(file.path, file.name, bytes);

      final updatedImages = List<String>.from(widget.images)..add(url);
      widget.onImagesChanged(updatedImages);

      if (widget.coverUrlController.text.trim().isEmpty) {
        widget.coverUrlController.text = url;
      }

      if (mounted) {
        ToastNotification.show(context, title: 'Uploaded', message: 'Image uploaded successfully!');
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(context, title: 'Upload Failed', message: e.toString(), isError: true);
      }
    } finally {
      if (mounted) setState(() => _isUploadingImage = false);
    }
  } // 'general', 'media', 'shortlink', 'related'

  final DateFormat _dateFormat = DateFormat('MM / dd / yyyy,  hh : mm  a');

  Future<void> _pickDateTime(BuildContext context, bool isCreated) async {
    final initialDate = isCreated ? (widget.createdAt ?? DateTime.now()) : (widget.publishedAt ?? DateTime.now());
    
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );

    if (pickedDate != null && context.mounted) {
      final pickedTime = await showTimePicker(
        context: context,
        initialTime: TimeOfDay.fromDateTime(initialDate),
      );

      if (pickedTime != null) {
        final combined = DateTime(
          pickedDate.year,
          pickedDate.month,
          pickedDate.day,
          pickedTime.hour,
          pickedTime.minute,
        );

        if (isCreated) {
          widget.onCreatedAtChanged(combined);
        } else {
          widget.onPublishedAtChanged(combined);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          // Header Bar
          InkWell(
            onTap: () => setState(() => _isCollapsed = !_isCollapsed),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  Icon(LucideIcons.sliders, size: 16, color: colorScheme.primary),
                  const SizedBox(width: 8),
                  const Text(
                    'Post Metadata & Extra Settings',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const Spacer(),
                  Text(
                    _isCollapsed ? 'Expand Settings' : 'Collapse Settings',
                    style: TextStyle(fontSize: 12, color: colorScheme.onSurface.withValues(alpha: 0.5)),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    _isCollapsed ? LucideIcons.chevronDown : LucideIcons.chevronUp,
                    size: 16,
                    color: colorScheme.onSurface.withValues(alpha: 0.5),
                  ),
                ],
              ),
            ),
          ),

          if (!_isCollapsed) ...[
            Divider(height: 1, color: colorScheme.outline.withValues(alpha: 0.2)),

            // Sub-Tabs
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  _buildTabButton(context, key: 'general', label: 'General & Locations', icon: LucideIcons.sliders),
                  const SizedBox(width: 6),
                  _buildTabButton(context, key: 'media', label: 'Cover & Media (${widget.images.length})', icon: LucideIcons.image),
                  const SizedBox(width: 6),
                  _buildTabButton(context, key: 'shortlink', label: 'RapidLink Short URL', icon: LucideIcons.link),
                  const SizedBox(width: 6),
                  _buildTabButton(context, key: 'related', label: 'Related Posts', icon: LucideIcons.layers),
                ],
              ),
            ),

            Divider(height: 1, color: colorScheme.outline.withValues(alpha: 0.2)),

            // Tab Content
            Padding(
              padding: const EdgeInsets.all(14),
              child: _buildActiveTabContent(context),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTabButton(BuildContext context, {required String key, required String label, required IconData icon}) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isSelected = _activeTab == key;

    return InkWell(
      onTap: () => setState(() => _activeTab = key),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? colorScheme.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected ? colorScheme.primary : colorScheme.outline.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: isSelected ? Colors.white : colorScheme.onSurface),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? Colors.white : colorScheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveTabContent(BuildContext context) {
    switch (_activeTab) {
      case 'media':
        return _buildMediaTab(context);
      case 'shortlink':
        return _buildShortlinkTab(context);
      case 'related':
        return _buildRelatedTab(context);
      case 'general':
      default:
        return _buildGeneralTab(context);
    }
  }

  Widget _buildGeneralTab(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Row 1: Slug & Status
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Slug (auto-generated if empty)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: widget.slugController,
                    style: const TextStyle(fontSize: 13),
                    decoration: const InputDecoration(hintText: 'my-microblog-slug'),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Status', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  DropdownButtonFormField<String>(
                    initialValue: widget.status,
                    isDense: true,
                    style: TextStyle(fontSize: 13, color: colorScheme.onSurface),
                    items: const [
                      DropdownMenuItem(value: 'draft', child: Text('Draft')),
                      DropdownMenuItem(value: 'published', child: Text('Published')),
                      DropdownMenuItem(value: 'scheduled', child: Text('Scheduled')),
                      DropdownMenuItem(value: 'archived', child: Text('Archived')),
                    ],
                    onChanged: (val) {
                      if (val != null) widget.onStatusChanged(val);
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Row 2: Location & Trip Pickers
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Associated Location', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  DropdownButtonFormField<String?>(
                    initialValue: widget.selectedLocationId?.isEmpty ?? true ? null : widget.selectedLocationId,
                    isDense: true,
                    style: TextStyle(fontSize: 13, color: colorScheme.onSurface),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('-- None (No Location) --')),
                      ...widget.locations.map((loc) => DropdownMenuItem(
                            value: loc.id,
                            child: Text(loc.displayName, overflow: TextOverflow.ellipsis),
                          )),
                    ],
                    onChanged: widget.onLocationChanged,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Associated Trip', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  DropdownButtonFormField<String?>(
                    initialValue: widget.selectedTripId?.isEmpty ?? true ? null : widget.selectedTripId,
                    isDense: true,
                    style: TextStyle(fontSize: 13, color: colorScheme.onSurface),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('-- None (No Trip) --')),
                      ...widget.trips.map((trip) => DropdownMenuItem(
                            value: trip.id,
                            child: Text(trip.title, overflow: TextOverflow.ellipsis),
                          )),
                    ],
                    onChanged: widget.onTripChanged,
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Row 3: Created & Published Date Pickers
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Created Date & Time', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  InkWell(
                    onTap: () => _pickDateTime(context, true),
                    child: InputDecorator(
                      decoration: const InputDecoration(suffixIcon: Icon(LucideIcons.calendar, size: 16)),
                      child: Text(
                        widget.createdAt != null ? _dateFormat.format(widget.createdAt!) : '- Select -',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Published Date & Time', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  InkWell(
                    onTap: () => _pickDateTime(context, false),
                    child: InputDecorator(
                      decoration: const InputDecoration(suffixIcon: Icon(LucideIcons.calendar, size: 16)),
                      child: Text(
                        widget.publishedAt != null ? _dateFormat.format(widget.publishedAt!) : '- Select -',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Row 4: Tags
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Tags (comma-separated)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            TextField(
              controller: widget.tagsController,
              style: const TextStyle(fontSize: 13),
              decoration: const InputDecoration(hintText: 'hugo, thoughts, dev'),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Row 5: Social Cross-Posting Options Box
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: colorScheme.onSurface.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.globe, size: 14, color: colorScheme.primary),
                  const SizedBox(width: 6),
                  const Text(
                    'Social Media Cross-Posting Options',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: CheckboxListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      value: widget.postToBluesky,
                      onChanged: (val) => widget.onBlueskyChanged(val ?? true),
                      title: Row(
                        children: [
                          const Text('Post to Bluesky 🦋 ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                          Text(
                            widget.socialStatus.blueskyConnected ? '(Connected)' : '(Disconnected)',
                            style: TextStyle(
                              fontSize: 11,
                              color: widget.socialStatus.blueskyConnected ? Colors.green : Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Expanded(
                    child: CheckboxListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      value: widget.postToMastodon,
                      onChanged: (val) => widget.onMastodonChanged(val ?? true),
                      title: Row(
                        children: [
                          const Text('Post to Mastodon 🐘 ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                          Text(
                            widget.socialStatus.mastodonConnected ? '(Connected)' : '(Disconnected)',
                            style: TextStyle(
                              fontSize: 11,
                              color: widget.socialStatus.mastodonConnected ? Colors.green : Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMediaTab(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Upload Media / Cover', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ElevatedButton.icon(
              onPressed: _isUploadingImage ? null : _pickAndUploadImage,
              style: ElevatedButton.styleFrom(
                backgroundColor: colorScheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              icon: _isUploadingImage
                  ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(LucideIcons.upload, size: 14),
              label: Text(_isUploadingImage ? 'Uploading...' : 'Upload Image', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const Text('Cover Image URL', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        TextField(
          controller: widget.coverUrlController,
          style: const TextStyle(fontSize: 13),
          decoration: const InputDecoration(hintText: 'https://example.com/cover.jpg'),
        ),
        const SizedBox(height: 12),
        Text('Attached Images (${widget.images.length})', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        if (widget.images.isEmpty)
          const Text('No attached images.', style: TextStyle(fontSize: 12, color: Colors.grey))
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: widget.images.map((imgUrl) {
              return Stack(
                children: [
                  Container(
                    width: 70,
                    height: 70,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      image: DecorationImage(image: NetworkImage(imgUrl), fit: BoxFit.cover),
                    ),
                  ),
                  Positioned(
                    top: 2,
                    right: 2,
                    child: GestureDetector(
                      onTap: () {
                        final updated = List<String>.from(widget.images)..remove(imgUrl);
                        widget.onImagesChanged(updated);
                      },
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                        child: const Icon(LucideIcons.x, size: 12, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              );
            }).toList(),
          ),
      ],
    );
  }

  Widget _buildShortlinkTab(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('RapidLink Short URL', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: widget.shortUrlController,
                readOnly: true,
                style: const TextStyle(fontSize: 13),
                decoration: const InputDecoration(hintText: 'Short URL will appear after saving'),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton.icon(
              onPressed: widget.onGenerateShortLink,
              icon: const Icon(LucideIcons.link, size: 14),
              label: const Text('Generate'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildRelatedTab(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Related Microblog Posts', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        SizedBox(height: 6),
        Text('Auto-matched related posts based on tag intersection and similarity will appear here.', style: TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }
}
