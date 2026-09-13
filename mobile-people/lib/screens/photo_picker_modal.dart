import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/services/image_cache_manager.dart';
import '../core/models/person_record.dart';
import '../core/models/picker_items.dart';
import '../core/network/api_service.dart';
import '../core/network/sync_service.dart';
import '../core/theme/cupertino_theme.dart';

class PhotoPickerModal extends StatefulWidget {
  final PersonRecord person;
  final VoidCallback onSuccess;

  const PhotoPickerModal({
    super.key,
    required this.person,
    required this.onSuccess,
  });

  static Future<void> show(
    BuildContext context, {
    required PersonRecord person,
    required VoidCallback onSuccess,
  }) {
    return showCupertinoModalPopup<void>(
      context: context,
      builder: (_) => PhotoPickerModal(person: person, onSuccess: onSuccess),
    );
  }

  @override
  State<PhotoPickerModal> createState() => _PhotoPickerModalState();
}

class _PhotoPickerModalState extends State<PhotoPickerModal> {
  int _selectedSegment = 0; // 0: Gallery (R2), 1: Cloudinary, 2: Upload
  final TextEditingController _verbController = TextEditingController(text: 'appears_in');

  // Multi-selection state
  final Map<String, Map<String, dynamic>> _selectedPhotos = {};

  // Gallery (Cloudflare R2) state
  List<PickerItem> _galleryPhotos = [];
  bool _loadingGallery = true;

  // Cloudinary state
  List<Map<String, dynamic>> _cloudinaryPhotos = [];
  bool _loadingCloudinary = false;
  bool _loadedCloudinaryOnce = false;

  // Upload state
  final List<Map<String, dynamic>> _uploadedPhotos = [];
  bool _isUploading = false;
  String? _uploadStatusMessage;

  // Submission state
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadGalleryPhotos();
  }

  @override
  void dispose() {
    _verbController.dispose();
    super.dispose();
  }

  Future<void> _loadGalleryPhotos() async {
    setState(() => _loadingGallery = true);
    try {
      final pickers = await ApiService.getPickers();
      if (mounted) {
        setState(() {
          _galleryPhotos = pickers.photos;
          _loadingGallery = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingGallery = false);
    }
  }

  Future<void> _loadCloudinaryPhotos() async {
    if (_loadedCloudinaryOnce) return;
    setState(() => _loadingCloudinary = true);
    try {
      final photos = await ApiService.getCloudinaryPhotos();
      if (mounted) {
        setState(() {
          _cloudinaryPhotos = photos;
          _loadingCloudinary = false;
          _loadedCloudinaryOnce = true;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingCloudinary = false);
    }
  }

  void _onSegmentChanged(int? newSegment) {
    if (newSegment == null) return;
    setState(() => _selectedSegment = newSegment);
    HapticFeedback.selectionClick();
    if (newSegment == 1 && !_loadedCloudinaryOnce) {
      _loadCloudinaryPhotos();
    }
  }

  void _togglePhoto(String key, Map<String, dynamic> item) {
    HapticFeedback.selectionClick();
    setState(() {
      if (_selectedPhotos.containsKey(key)) {
        _selectedPhotos.remove(key);
      } else {
        _selectedPhotos[key] = item;
      }
    });
  }

  Future<void> _pickFromCamera() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.camera, maxWidth: 1920, imageQuality: 85);
    if (file == null) return;
    await _uploadPickedFile(file);
  }

  Future<void> _pickFromGallery() async {
    final picker = ImagePicker();
    final files = await picker.pickMultiImage(maxWidth: 1920, imageQuality: 85);
    if (files.isEmpty) return;

    for (final file in files) {
      await _uploadPickedFile(file);
    }
  }

  Future<void> _uploadPickedFile(XFile file) async {
    setState(() {
      _isUploading = true;
      _uploadStatusMessage = 'Uploading ${file.name}...';
      _errorMessage = null;
    });

    try {
      final bytes = await file.readAsBytes();
      final uploadedUrl = await ApiService.uploadAvatar(file.name, bytes);

      final item = {
        'type': 'cloudinary',
        'url': uploadedUrl,
        'title': file.name,
        'publicId': file.name,
      };

      if (mounted) {
        setState(() {
          _uploadedPhotos.insert(0, item);
          final key = 'upload_${_uploadedPhotos.length}_${file.name}';
          _selectedPhotos[key] = item;
          _uploadStatusMessage = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Upload failed for ${file.name}: $e';
        });
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Future<void> _handleSubmit() async {
    if (_selectedPhotos.isEmpty) {
      setState(() => _errorMessage = 'Please select at least one photo.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    HapticFeedback.lightImpact();

    final photosList = _selectedPhotos.values.toList();
    final verb = _verbController.text.trim();
    final relationship = verb.isNotEmpty ? verb : 'appears_in';

    try {
      final ok = await ApiService.connectPhotosBatch(
        personId: widget.person.id,
        photos: photosList,
        relationship: relationship,
      );

      if (ok && mounted) {
        widget.onSuccess();
        Navigator.of(context).pop();
      } else {
        throw Exception('Failed to connect photos');
      }
    } catch (e) {
      // Offline fallback: queue offline mutations
      for (final photo in photosList) {
        await SyncService.queueMutation(
          type: 'add_connection',
          entityId: widget.person.id,
          payload: {
            'targetType': photo['type'] == 'gallery' ? 'gallery' : 'cloudinary',
            'targetId': photo['id'] ?? photo['url'],
            'relationship': relationship,
            'url': photo['url'],
            'title': photo['title'],
          },
        );
      }
      if (mounted) {
        widget.onSuccess();
        Navigator.of(context).pop();
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = AppCupertinoTheme.isDark(context);
    final cardBg = AppCupertinoTheme.cardBackground.resolveFrom(context);
    final totalSelected = _selectedPhotos.length;

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: AppCupertinoTheme.cardBorder.resolveFrom(context),
            width: 0.8,
          ),
          boxShadow: [
            BoxShadow(
              color: CupertinoColors.systemGrey5.resolveFrom(context).withValues(alpha: 0.4),
              offset: const Offset(0, 4),
              blurRadius: 16,
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 14, 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF007AFF).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(CupertinoIcons.photo, color: Color(0xFF007AFF), size: 18),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Add Photos',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.3,
                              color: AppCupertinoTheme.label(context),
                            ),
                          ),
                          Text(
                            widget.person.displayName,
                            style: TextStyle(
                              fontSize: 12,
                              color: AppCupertinoTheme.secondary(context),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  CupertinoButton(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Icon(CupertinoIcons.clear_circled_solid, color: CupertinoColors.systemGrey, size: 24),
                  ),
                ],
              ),
            ),

            // 3-Tab Sliding Segmented Control
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: CupertinoSlidingSegmentedControl<int>(
                groupValue: _selectedSegment,
                onValueChanged: _onSegmentChanged,
                children: const {
                  0: Padding(
                    padding: EdgeInsets.symmetric(vertical: 7),
                    child: Text('Gallery (R2)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ),
                  1: Padding(
                    padding: EdgeInsets.symmetric(vertical: 7),
                    child: Text('Cloudinary', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ),
                  2: Padding(
                    padding: EdgeInsets.symmetric(vertical: 7),
                    child: Text('Upload', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ),
                },
              ),
            ),

            const SizedBox(height: 8),

            // Tab Body Content
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: _buildTabContent(isDark),
              ),
            ),

            // Error message banner
            if (_errorMessage != null) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: CupertinoColors.systemRed, fontSize: 12),
                  textAlign: TextAlign.center,
                ),
              ),
            ],

            // Bottom Connection Controls
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? const Color(0x18FFFFFF) : const Color(0x0A000000),
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
                border: Border(
                  top: BorderSide(
                    color: isDark ? const Color(0x20FFFFFF) : const Color(0x15000000),
                    width: 0.8,
                  ),
                ),
              ),
              child: Row(
                children: [
                  // Selected Counter & Verb
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '$totalSelected photo${totalSelected == 1 ? '' : 's'} selected',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: totalSelected > 0 ? const Color(0xFF007AFF) : AppCupertinoTheme.secondary(context),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Text(
                              'Verb: ',
                              style: TextStyle(fontSize: 11, color: AppCupertinoTheme.secondary(context)),
                            ),
                            SizedBox(
                              width: 90,
                              height: 24,
                              child: CupertinoTextField(
                                controller: _verbController,
                                placeholder: 'appears_in',
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                style: const TextStyle(fontSize: 11),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(6),
                                  color: isDark ? const Color(0x20FFFFFF) : const Color(0x15000000),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Connect Button
                  CupertinoButton.filled(
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                    borderRadius: BorderRadius.circular(10),
                    onPressed: (totalSelected == 0 || _isSubmitting) ? null : _handleSubmit,
                    child: _isSubmitting
                        ? const CupertinoActivityIndicator(color: CupertinoColors.white)
                        : Text(
                            totalSelected > 0 ? 'Connect ($totalSelected)' : 'Connect',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
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

  Widget _buildTabContent(bool isDark) {
    if (_selectedSegment == 0) {
      // TAB 0: GALLERY (CLOUDFLARE R2)
      if (_loadingGallery) {
        return const Center(child: CupertinoActivityIndicator());
      }
      if (_galleryPhotos.isEmpty) {
        return Center(
          child: Text(
            'No gallery photos found in Cloudflare R2.',
            style: TextStyle(color: AppCupertinoTheme.secondary(context), fontSize: 13),
          ),
        );
      }
      return GridView.builder(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
        ),
        itemCount: _galleryPhotos.length,
        itemBuilder: (context, index) {
          final photo = _galleryPhotos[index];
          final key = 'gallery_${photo.id}';
          final isSelected = _selectedPhotos.containsKey(key);

          return GestureDetector(
            onTap: () => _togglePhoto(key, {
              'type': 'gallery',
              'id': photo.id,
              'title': photo.title,
              'url': photo.subtitle, // subtitle contains thumbnailUrl
            }),
            child: _buildThumbnailCell(
              imageUrl: photo.subtitle ?? '',
              title: photo.title,
              isSelected: isSelected,
            ),
          );
        },
      );
    } else if (_selectedSegment == 1) {
      // TAB 1: CLOUDINARY
      if (_loadingCloudinary) {
        return const Center(child: CupertinoActivityIndicator());
      }
      if (_cloudinaryPhotos.isEmpty) {
        return Center(
          child: Text(
            'No images found in Cloudinary.',
            style: TextStyle(color: AppCupertinoTheme.secondary(context), fontSize: 13),
          ),
        );
      }
      return GridView.builder(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
        ),
        itemCount: _cloudinaryPhotos.length,
        itemBuilder: (context, index) {
          final c = _cloudinaryPhotos[index];
          final publicId = c['public_id'] as String? ?? 'image_$index';
          final url = c['secure_url'] as String? ?? '';
          final key = 'cloudinary_$publicId';
          final isSelected = _selectedPhotos.containsKey(key);

          return GestureDetector(
            onTap: () => _togglePhoto(key, {
              'type': 'cloudinary',
              'url': url,
              'publicId': publicId,
              'title': publicId.split('/').last,
            }),
            child: _buildThumbnailCell(
              imageUrl: url,
              title: publicId.split('/').last,
              isSelected: isSelected,
            ),
          );
        },
      );
    } else {
      // TAB 2: UPLOAD
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: CupertinoButton(
                  color: isDark ? const Color(0x30FFFFFF) : const Color(0x15000000),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  borderRadius: BorderRadius.circular(12),
                  onPressed: _isUploading ? null : _pickFromCamera,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(CupertinoIcons.camera, size: 18, color: Color(0xFF007AFF)),
                      const SizedBox(width: 6),
                      Text(
                        'Take Photo',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppCupertinoTheme.label(context),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: CupertinoButton(
                  color: isDark ? const Color(0x30FFFFFF) : const Color(0x15000000),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  borderRadius: BorderRadius.circular(12),
                  onPressed: _isUploading ? null : _pickFromGallery,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(CupertinoIcons.photo_on_rectangle, size: 18, color: Color(0xFF007AFF)),
                      const SizedBox(width: 6),
                      Text(
                        'Photo Library',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppCupertinoTheme.label(context),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (_uploadStatusMessage != null) ...[
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CupertinoActivityIndicator(),
                  const SizedBox(width: 8),
                  Text(_uploadStatusMessage!, style: const TextStyle(fontSize: 12, color: Color(0xFF007AFF))),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          Text(
            'UPLOADED PHOTOS (${_uploadedPhotos.length})',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppCupertinoTheme.secondary(context)),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: _uploadedPhotos.isEmpty
                ? Center(
                    child: Text(
                      'No new photos uploaded yet.\nTap Camera or Photo Library to upload to Cloudinary.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppCupertinoTheme.secondary(context), fontSize: 12),
                    ),
                  )
                : GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                    ),
                    itemCount: _uploadedPhotos.length,
                    itemBuilder: (context, index) {
                      final item = _uploadedPhotos[index];
                      final url = item['url'] as String? ?? '';
                      final title = item['title'] as String? ?? 'Photo';
                      final key = 'upload_${index}_$title';
                      final isSelected = _selectedPhotos.containsKey(key);

                      return GestureDetector(
                        onTap: () => _togglePhoto(key, item),
                        child: _buildThumbnailCell(
                          imageUrl: url,
                          title: title,
                          isSelected: isSelected,
                        ),
                      );
                    },
                  ),
          ),
        ],
      );
    }
  }

  Widget _buildThumbnailCell({
    required String imageUrl,
    required String title,
    required bool isSelected,
  }) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isSelected ? const Color(0xFF007AFF) : CupertinoColors.systemGrey4,
          width: isSelected ? 2.5 : 0.8,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            imageUrl.isNotEmpty
                ? CachedNetworkImage(
                    cacheManager: PeopleImageCacheManager.instance,
                    imageUrl: imageUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, _) => Container(color: CupertinoColors.systemGrey6),
                    errorWidget: (_, _, _) => Container(
                      color: CupertinoColors.systemGrey5,
                      child: const Icon(CupertinoIcons.photo, color: CupertinoColors.systemGrey),
                    ),
                  )
                : Container(
                    color: CupertinoColors.systemGrey5,
                    child: const Icon(CupertinoIcons.photo, color: CupertinoColors.systemGrey),
                  ),

            // Selection Checkmark Badge
            Positioned(
              top: 4,
              right: 4,
              child: Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isSelected ? const Color(0xFF007AFF) : const Color(0x66000000),
                  border: Border.all(color: CupertinoColors.white, width: 1.5),
                ),
                child: isSelected
                    ? const Icon(CupertinoIcons.check_mark, color: CupertinoColors.white, size: 12)
                    : null,
              ),
            ),

            // Title banner at bottom
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                color: const Color(0x99000000),
                child: Text(
                  title,
                  style: const TextStyle(color: CupertinoColors.white, fontSize: 9, fontWeight: FontWeight.w500),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
