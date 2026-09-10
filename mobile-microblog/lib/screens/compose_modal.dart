import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../core/models/microblog_post.dart';
import '../core/network/api_service.dart';
import '../core/theme/cupertino_theme.dart';

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
  final FocusNode _contentFocusNode = FocusNode();
  final ImagePicker _picker = ImagePicker();

  String _status = 'published';
  final List<String> _tags = [];
  final List<String> _images = [];

  bool _isSaving = false;
  bool _isUploadingImage = false;

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
    }
    _updateCounts();
    _contentController.addListener(_updateCounts);
  }

  @override
  void dispose() {
    _contentController.removeListener(_updateCounts);
    _contentController.dispose();
    _tagController.dispose();
    _contentFocusNode.dispose();
    super.dispose();
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
      final payload = <String, dynamic>{
        if (widget.editPost != null) 'id': widget.editPost!.id,
        'contentMarkdown': content,
        'status': _status,
        'tags': _tags,
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
