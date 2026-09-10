import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../core/models/microblog_post.dart';
import '../core/models/location_item.dart';
import '../core/models/trip_item.dart';
import '../core/network/api_service.dart';
import '../core/theme/cupertino_theme.dart';
import '../widgets/association_picker_sheet.dart';

class ComposeModal extends StatefulWidget {
  final MicroblogPost? editPost;
  final VoidCallback onSaved;

  const ComposeModal({
    super.key,
    this.editPost,
    required this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    MicroblogPost? editPost,
    required VoidCallback onSaved,
  }) async {
    await Navigator.of(context).push(
      CupertinoPageRoute(
        fullscreenDialog: true,
        builder: (_) => ComposeModal(
          editPost: editPost,
          onSaved: onSaved,
        ),
      ),
    );
  }

  @override
  State<ComposeModal> createState() => _ComposeModalState();
}

class _ComposeModalState extends State<ComposeModal> {
  final TextEditingController _contentController = TextEditingController();
  final TextEditingController _tagController = TextEditingController();
  final TextEditingController _slugController = TextEditingController();
  final FocusNode _contentFocusNode = FocusNode();
  final FocusNode _slugFocusNode = FocusNode();
  final ImagePicker _picker = ImagePicker();

  String _status = 'published';
  final List<String> _tags = [];
  final List<String> _images = [];

  bool _isSaving = false;
  bool _isUploadingImage = false;
  bool _isCustomSlug = false;
  bool _isAdvancedExpanded = false;

  List<LocationItem> _locations = [];
  List<TripItem> _trips = [];
  LocationItem? _selectedLocation;
  TripItem? _selectedTrip;
  bool _isLoadingAssociations = false;

  int _characterCount = 0;
  int _wordCount = 0;

  @override
  void initState() {
    super.initState();
    if (widget.editPost != null) {
      final p = widget.editPost!;
      _contentController.text = p.contentMarkdown;
      _status = p.status;
      _tags.addAll(p.tags);
      if (p.coverImageUrl != null && p.coverImageUrl!.isNotEmpty) {
        _images.add(p.coverImageUrl!);
      }
      for (final img in p.images) {
        if (!_images.contains(img)) _images.add(img);
      }
      _slugController.text = p.slug;
      _isCustomSlug = true;

      // Auto-expand advanced options drawer if associations exist
      if (p.locationId != null || p.tripId != null) {
        _isAdvancedExpanded = true;
      }

      // Initial fallbacks for display before network fetch completes
      if (p.locationId != null && p.locationName != null) {
        _selectedLocation = LocationItem(
          id: p.locationId!,
          name: p.locationName!,
          slug: '',
          city: p.locationCity,
        );
      }
      if (p.tripId != null && p.tripTitle != null) {
        _selectedTrip = TripItem(
          id: p.tripId!,
          title: p.tripTitle!,
          slug: '',
        );
      }

      _loadPostDetailsAndAssociations(p);
    } else {
      _slugController.text = _generateSlug('');
      _loadAssociations();
    }

    _updateCounts();
    _contentController.addListener(_onContentChanged);
  }

  @override
  void dispose() {
    _contentController.removeListener(_onContentChanged);
    _contentController.dispose();
    _tagController.dispose();
    _slugController.dispose();
    _contentFocusNode.dispose();
    _slugFocusNode.dispose();
    super.dispose();
  }

  void _onContentChanged() {
    _updateCounts();
    if (!_isCustomSlug && widget.editPost == null) {
      final newSlug = _generateSlug(_contentController.text);
      if (_slugController.text != newSlug) {
        _slugController.text = newSlug;
      }
    }
  }

  void _updateCounts() {
    final text = _contentController.text;
    final chars = text.length;
    final words = text.trim().isEmpty
        ? 0
        : text.trim().split(RegExp(r'\s+')).length;

    setState(() {
      _characterCount = chars;
      _wordCount = words;
    });
  }

  String _generateSlug(String content) {
    final clean = content
        .toLowerCase()
        .replaceAll(RegExp(r'[^\w\s-]'), '')
        .trim()
        .replaceAll(RegExp(r'\s+'), '-')
        .split('')
        .take(50)
        .join();

    final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
    final suffix = timestamp.length > 6 ? timestamp.substring(timestamp.length - 6) : timestamp;
    return clean.isNotEmpty ? '$clean-$suffix' : 'post-$suffix';
  }

  void _resetSlugToAuto() {
    setState(() {
      _isCustomSlug = false;
      _slugController.text = _generateSlug(_contentController.text);
    });
    HapticFeedback.lightImpact();
  }

  Future<void> _loadPostDetailsAndAssociations(MicroblogPost p) async {
    // If post had empty images when passed, fetch fresh single post from backend
    if (_images.isEmpty && p.id.isNotEmpty) {
      try {
        final fullPost = await ApiService.getPostById(p.id);
        if (fullPost != null && mounted) {
          setState(() {
            if (fullPost.coverImageUrl != null && fullPost.coverImageUrl!.isNotEmpty) {
              if (!_images.contains(fullPost.coverImageUrl!)) {
                _images.add(fullPost.coverImageUrl!);
              }
            }
            for (final img in fullPost.images) {
              if (!_images.contains(img)) _images.add(img);
            }
            if (_tags.isEmpty) _tags.addAll(fullPost.tags);
          });
        }
      } catch (_) {}
    }

    await _loadAssociations(
      selectedLocationId: p.locationId,
      selectedTripId: p.tripId,
    );
  }

  Future<void> _loadAssociations({String? selectedLocationId, String? selectedTripId}) async {
    setState(() => _isLoadingAssociations = true);
    try {
      final results = await Future.wait([
        ApiService.getLocations(),
        ApiService.getTrips(),
      ]);

      if (!mounted) return;

      final locs = results[0] as List<LocationItem>;
      final trips = results[1] as List<TripItem>;

      setState(() {
        _locations = locs;
        _trips = trips;
        _isLoadingAssociations = false;

        final targetLocId = selectedLocationId ?? widget.editPost?.locationId;
        final targetTripId = selectedTripId ?? widget.editPost?.tripId;

        if (targetLocId != null && targetLocId.isNotEmpty) {
          final matched = locs.where((l) => l.id == targetLocId).firstOrNull;
          if (matched != null) {
            _selectedLocation = matched;
          }
        }

        if (targetTripId != null && targetTripId.isNotEmpty) {
          final matched = trips.where((t) => t.id == targetTripId).firstOrNull;
          if (matched != null) {
            _selectedTrip = matched;
          }
        }
      });
    } catch (_) {
      if (mounted) {
        setState(() => _isLoadingAssociations = false);
      }
    }
  }

  void _addTag(String rawTag) {
    final clean = rawTag.trim().replaceAll('#', '').toLowerCase();
    if (clean.isNotEmpty && !_tags.contains(clean)) {
      setState(() {
        _tags.add(clean);
        _tagController.clear();
      });
      HapticFeedback.lightImpact();
    }
  }

  void _removeTag(String tag) {
    setState(() {
      _tags.remove(tag);
    });
    HapticFeedback.lightImpact();
  }

  void _showLocationPicker() {
    final options = _locations
        .map((loc) => PickerOption<LocationItem>(
              id: loc.id,
              title: loc.name,
              subtitle: loc.subtitle,
              rawItem: loc,
            ))
        .toList();

    AssociationPickerSheet.show<LocationItem>(
      context: context,
      title: 'Select Location',
      searchPlaceholder: 'Search locations...',
      selectedId: _selectedLocation?.id,
      options: options,
      onSelected: (opt) {
        setState(() => _selectedLocation = opt?.rawItem);
      },
    );
  }

  void _showTripPicker() {
    final options = _trips
        .map((trip) => PickerOption<TripItem>(
              id: trip.id,
              title: trip.title,
              subtitle: trip.displayStatus.isNotEmpty ? 'Status: ${trip.displayStatus}' : null,
              rawItem: trip,
            ))
        .toList();

    AssociationPickerSheet.show<TripItem>(
      context: context,
      title: 'Select Trip',
      searchPlaceholder: 'Search trips...',
      selectedId: _selectedTrip?.id,
      options: options,
      onSelected: (opt) {
        setState(() => _selectedTrip = opt?.rawItem);
      },
    );
  }

  Future<void> _pickAndUploadImage(ImageSource source) async {
    try {
      final picked = await _picker.pickImage(
        source: source,
        maxWidth: 2000,
        imageQuality: 85,
      );

      if (picked == null) return;

      setState(() => _isUploadingImage = true);

      final bytes = await picked.readAsBytes();
      final uploadedUrl = await ApiService.uploadImage(picked.name, bytes);

      if (mounted) {
        setState(() {
          _images.add(uploadedUrl);
          _isUploadingImage = false;
        });
        HapticFeedback.lightImpact();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isUploadingImage = false);
        _showErrorDialog('Image Upload Failed', e.toString());
      }
    }
  }

  void _showImageSourcePicker() {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => CupertinoActionSheet(
        title: const Text('Add Image'),
        actions: [
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.of(ctx).pop();
              _pickAndUploadImage(ImageSource.gallery);
            },
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(CupertinoIcons.photo),
                SizedBox(width: 8),
                Text('Photo Library'),
              ],
            ),
          ),
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.of(ctx).pop();
              _pickAndUploadImage(ImageSource.camera);
            },
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(CupertinoIcons.camera),
                SizedBox(width: 8),
                Text('Take Photo'),
              ],
            ),
          ),
        ],
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('Cancel'),
        ),
      ),
    );
  }

  Future<void> _handleSave() async {
    final content = _contentController.text.trim();
    if (content.isEmpty) {
      _showErrorDialog('Validation Error', 'Please write some content before saving.');
      return;
    }

    setState(() => _isSaving = true);
    HapticFeedback.mediumImpact();

    try {
      final slugVal = _slugController.text.trim();
      final payload = <String, dynamic>{
        if (widget.editPost != null) 'id': widget.editPost!.id,
        if (slugVal.isNotEmpty) 'slug': slugVal,
        'contentMarkdown': content,
        'status': _status,
        'tags': _tags,
        'locationId': _selectedLocation?.id,
        'tripId': _selectedTrip?.id,
        'images': _images,
        'coverImageUrl': _images.isNotEmpty ? _images.first : null,
      };

      await ApiService.savePost(payload);

      if (mounted) {
        setState(() => _isSaving = false);
        widget.onSaved();
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        _showErrorDialog('Failed to Save', e.toString());
      }
    }
  }

  void _showErrorDialog(String title, String message) {
    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Widget _buildAdvancedDrawer(BuildContext context) {
    final hasActiveSettings = _selectedLocation != null ||
        _selectedTrip != null ||
        (_isCustomSlug && _slugController.text.trim().isNotEmpty);

    return Container(
      decoration: BoxDecoration(
        color: AppCupertinoTheme.cardBackground.resolveFrom(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppCupertinoTheme.cardBorder.resolveFrom(context),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drawer Header / Toggle
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              setState(() => _isAdvancedExpanded = !_isAdvancedExpanded);
              HapticFeedback.selectionClick();
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Icon(
                    CupertinoIcons.slider_horizontal_3,
                    size: 18,
                    color: CupertinoColors.activeBlue.resolveFrom(context),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Advanced Options',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: CupertinoColors.label.resolveFrom(context),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (hasActiveSettings && !_isAdvancedExpanded)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: CupertinoColors.activeBlue.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        [
                          if (_selectedLocation != null) '📍 ${_selectedLocation!.name}',
                          if (_selectedTrip != null) '✈️ ${_selectedTrip!.title}',
                          if (_isCustomSlug) 'Custom Slug',
                        ].join(' · '),
                        style: const TextStyle(
                          fontSize: 11,
                          color: CupertinoColors.activeBlue,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  const Spacer(),
                  if (_isLoadingAssociations) ...[
                    const CupertinoActivityIndicator(radius: 7),
                    const SizedBox(width: 8),
                  ],
                  Icon(
                    _isAdvancedExpanded
                        ? CupertinoIcons.chevron_down
                        : CupertinoIcons.chevron_forward,
                    size: 16,
                    color: CupertinoColors.secondaryLabel.resolveFrom(context),
                  ),
                ],
              ),
            ),
          ),

          // Collapsible Content
          if (_isAdvancedExpanded) ...[
            Container(
              height: 0.5,
              color: AppCupertinoTheme.cardBorder.resolveFrom(context).withValues(alpha: 0.5),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Slug Field
                  Row(
                    children: [
                      Text(
                        'URL Slug',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: CupertinoColors.secondaryLabel.resolveFrom(context),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: _isCustomSlug
                              ? CupertinoColors.systemOrange.withValues(alpha: 0.15)
                              : CupertinoColors.systemGreen.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          _isCustomSlug ? 'Manual' : 'Auto',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: _isCustomSlug
                                ? CupertinoColors.systemOrange
                                : CupertinoColors.systemGreen,
                          ),
                        ),
                      ),
                      const Spacer(),
                      if (_isCustomSlug && widget.editPost == null)
                        CupertinoButton(
                          padding: EdgeInsets.zero,
                          minimumSize: Size.zero,
                          onPressed: _resetSlugToAuto,
                          child: const Text('Reset to Auto', style: TextStyle(fontSize: 12)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  CupertinoTextField(
                    controller: _slugController,
                    focusNode: _slugFocusNode,
                    placeholder: 'post-slug',
                    prefix: const Padding(
                      padding: EdgeInsets.only(left: 10),
                      child: Icon(CupertinoIcons.link, size: 16, color: CupertinoColors.systemGrey),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    style: TextStyle(
                      fontSize: 14,
                      color: CupertinoColors.label.resolveFrom(context),
                    ),
                    onChanged: (val) {
                      if (!_isCustomSlug && val.isNotEmpty) {
                        setState(() => _isCustomSlug = true);
                      }
                    },
                  ),
                  const SizedBox(height: 14),

                  // Location Row
                  GestureDetector(
                    onTap: _showLocationPicker,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            CupertinoIcons.location_solid,
                            size: 18,
                            color: CupertinoColors.systemTeal,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Location',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: CupertinoColors.secondaryLabel,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _selectedLocation?.displayName ?? 'None (Tap to select)',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: _selectedLocation != null
                                        ? FontWeight.w600
                                        : FontWeight.normal,
                                    color: _selectedLocation != null
                                        ? CupertinoColors.label.resolveFrom(context)
                                        : CupertinoColors.placeholderText.resolveFrom(context),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (_selectedLocation != null)
                            GestureDetector(
                              onTap: () {
                                setState(() => _selectedLocation = null);
                                HapticFeedback.selectionClick();
                              },
                              child: const Padding(
                                padding: EdgeInsets.all(4),
                                child: Icon(
                                  CupertinoIcons.clear_circled_solid,
                                  size: 16,
                                  color: CupertinoColors.secondaryLabel,
                                ),
                              ),
                            )
                          else
                            const Icon(
                              CupertinoIcons.chevron_forward,
                              size: 14,
                              color: CupertinoColors.secondaryLabel,
                            ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 10),

                  // Trip Row
                  GestureDetector(
                    onTap: _showTripPicker,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            CupertinoIcons.airplane,
                            size: 18,
                            color: CupertinoColors.systemPurple,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Associated Trip',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: CupertinoColors.secondaryLabel,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _selectedTrip?.title ?? 'None (Tap to select)',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: _selectedTrip != null
                                        ? FontWeight.w600
                                        : FontWeight.normal,
                                    color: _selectedTrip != null
                                        ? CupertinoColors.label.resolveFrom(context)
                                        : CupertinoColors.placeholderText.resolveFrom(context),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (_selectedTrip != null)
                            GestureDetector(
                              onTap: () {
                                setState(() => _selectedTrip = null);
                                HapticFeedback.selectionClick();
                              },
                              child: const Padding(
                                padding: EdgeInsets.all(4),
                                child: Icon(
                                  CupertinoIcons.clear_circled_solid,
                                  size: 16,
                                  color: CupertinoColors.secondaryLabel,
                                ),
                              ),
                            )
                          else
                            const Icon(
                              CupertinoIcons.chevron_forward,
                              size: 14,
                              color: CupertinoColors.secondaryLabel,
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.editPost != null;

    return CupertinoPageScaffold(
      backgroundColor: CupertinoColors.systemGroupedBackground,
      navigationBar: CupertinoNavigationBar(
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: _isSaving ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        middle: Text(isEditing ? 'Edit Post' : 'New Microblog'),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: (_isSaving || _isUploadingImage) ? null : _handleSave,
          child: _isSaving
              ? const CupertinoActivityIndicator()
              : Text(
                  isEditing ? 'Update' : (_status == 'published' ? 'Publish' : 'Save Draft'),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
        ),
      ),
      child: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                children: [
                  // Status Segmented Control
                  CupertinoSlidingSegmentedControl<String>(
                    groupValue: _status,
                    children: const {
                      'published': Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        child: Text('Publish Instantly', style: TextStyle(fontSize: 14)),
                      ),
                      'draft': Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        child: Text('Draft', style: TextStyle(fontSize: 14)),
                      ),
                    },
                    onValueChanged: (val) {
                      if (val != null) {
                        setState(() => _status = val);
                        HapticFeedback.selectionClick();
                      }
                    },
                  ),
                  const SizedBox(height: 16),

                  // Main Text Content Input
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppCupertinoTheme.cardBackground.resolveFrom(context),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: AppCupertinoTheme.cardBorder.resolveFrom(context),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        CupertinoTextField(
                          controller: _contentController,
                          focusNode: _contentFocusNode,
                          placeholder: "What's happening? Markdown supported...",
                          placeholderStyle: TextStyle(
                            color: CupertinoColors.placeholderText.resolveFrom(context),
                            fontSize: 16,
                          ),
                          maxLines: null,
                          minLines: 6,
                          decoration: null,
                          style: TextStyle(
                            fontSize: 16,
                            height: 1.4,
                            color: CupertinoColors.label.resolveFrom(context),
                          ),
                        ),
                        const SizedBox(height: 12),
                        // Word / Char Counter
                        Align(
                          alignment: Alignment.centerRight,
                          child: Text(
                            '$_wordCount words · $_characterCount chars',
                            style: TextStyle(
                              fontSize: 12,
                              color: CupertinoColors.secondaryLabel.resolveFrom(context),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Uploaded Images Strip
                  if (_images.isNotEmpty || _isUploadingImage) ...[
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 88,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _images.length + (_isUploadingImage ? 1 : 0),
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemBuilder: (ctx, index) {
                          if (index == _images.length && _isUploadingImage) {
                            return Container(
                              width: 88,
                              decoration: BoxDecoration(
                                color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Center(child: CupertinoActivityIndicator()),
                            );
                          }

                          final url = _images[index];
                          return Stack(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.network(
                                  url,
                                  width: 88,
                                  height: 88,
                                  fit: BoxFit.cover,
                                  errorBuilder: (context, error, stackTrace) => Container(
                                    width: 88,
                                    height: 88,
                                    decoration: BoxDecoration(
                                      color: CupertinoColors.systemGrey5.resolveFrom(context),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Center(
                                      child: Icon(
                                        CupertinoIcons.photo,
                                        color: CupertinoColors.systemGrey,
                                        size: 28,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              Positioned(
                                top: 4,
                                right: 4,
                                child: GestureDetector(
                                  onTap: () {
                                    setState(() => _images.removeAt(index));
                                    HapticFeedback.lightImpact();
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.all(2),
                                    decoration: const BoxDecoration(
                                      color: CupertinoColors.black,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      CupertinoIcons.xmark,
                                      color: CupertinoColors.white,
                                      size: 14,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),

                  // Tags Section
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppCupertinoTheme.cardBackground.resolveFrom(context),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: AppCupertinoTheme.cardBorder.resolveFrom(context),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(CupertinoIcons.tag, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: CupertinoTextField(
                                controller: _tagController,
                                placeholder: 'Add tag (press enter)...',
                                decoration: null,
                                onSubmitted: _addTag,
                              ),
                            ),
                            CupertinoButton(
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              minimumSize: const Size(40, 30),
                              onPressed: () => _addTag(_tagController.text),
                              child: const Text('Add', style: TextStyle(fontSize: 14)),
                            ),
                          ],
                        ),
                        if (_tags.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _tags.map((t) {
                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text('#$t', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                                    const SizedBox(width: 4),
                                    GestureDetector(
                                      onTap: () => _removeTag(t),
                                      child: const Icon(CupertinoIcons.clear_circled_solid, size: 14),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Advanced Options Expandable Drawer (Slug, Location, Trip)
                  _buildAdvancedDrawer(context),
                ],
              ),
            ),

            // Bottom Quick Action Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: AppCupertinoTheme.cardBackground.resolveFrom(context),
                border: Border(
                  top: BorderSide(
                    color: AppCupertinoTheme.cardBorder.resolveFrom(context),
                    width: 0.5,
                  ),
                ),
              ),
              child: Row(
                children: [
                  CupertinoButton(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    onPressed: _isUploadingImage ? null : _showImageSourcePicker,
                    child: const Row(
                      children: [
                        Icon(CupertinoIcons.photo_on_rectangle, size: 22),
                        SizedBox(width: 6),
                        Text('Photo', style: TextStyle(fontSize: 14)),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Text(
                    _status == 'published' ? 'Will publish to Hugo' : 'Will save locally as draft',
                    style: TextStyle(
                      fontSize: 12,
                      color: CupertinoColors.secondaryLabel.resolveFrom(context),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
