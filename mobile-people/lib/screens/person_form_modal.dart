import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/models/person_record.dart';
import '../core/models/social_links.dart';
import '../core/models/important_date.dart';
import '../core/network/api_service.dart';
import '../core/network/sync_service.dart';
import '../core/storage/local_store.dart';
import '../core/services/image_cache_manager.dart';
import '../core/services/notification_service.dart';
import '../core/theme/cupertino_theme.dart';

class PersonFormModal extends StatefulWidget {
  final PersonRecord? personToEdit;
  final VoidCallback onSuccess;

  const PersonFormModal({
    super.key,
    this.personToEdit,
    required this.onSuccess,
  });

  static Future<void> show(
    BuildContext context, {
    PersonRecord? personToEdit,
    required VoidCallback onSuccess,
  }) {
    return Navigator.of(context).push(
      CupertinoPageRoute(
        fullscreenDialog: true,
        builder: (_) => PersonFormModal(
          personToEdit: personToEdit,
          onSuccess: onSuccess,
        ),
      ),
    );
  }

  @override
  State<PersonFormModal> createState() => _PersonFormModalState();
}

class _PersonFormModalState extends State<PersonFormModal> {
  final TextEditingController _displayNameController = TextEditingController();
  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();
  final TextEditingController _nicknameController = TextEditingController();
  final TextEditingController _slugController = TextEditingController();
  final TextEditingController _avatarUrlController = TextEditingController();
  final TextEditingController _customRelationshipController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();
  final TextEditingController _interestsController = TextEditingController();
  final TextEditingController _tagsController = TextEditingController();

  // Social Links Controllers
  final TextEditingController _instagramController = TextEditingController();
  final TextEditingController _facebookController = TextEditingController();
  final TextEditingController _githubController = TextEditingController();
  final TextEditingController _linkedinController = TextEditingController();
  final TextEditingController _websiteController = TextEditingController();

  String _relationshipType = 'Friend';
  String _visibility = 'private';
  bool _favorite = false;
  List<ImportantDate> _importantDates = [];

  bool _isAutoSlug = true;
  bool _isUploadingAvatar = false;
  bool _isSaving = false;
  String? _errorMessage;

  static const List<String> relationshipPresets = [
    'Friend',
    'Family',
    'Partner',
    'Relative',
    'Colleague',
    'Classmate',
    'Neighbor',
    'Mentor',
    'Custom',
  ];

  @override
  void initState() {
    super.initState();
    _populateFields();
    _displayNameController.addListener(_onDisplayNameChanged);
    _customRelationshipController.addListener(_onCustomRelationshipChanged);
  }

  void _populateFields() {
    final p = widget.personToEdit;
    if (p != null) {
      _displayNameController.text = p.displayName;
      _firstNameController.text = p.firstName ?? '';
      _lastNameController.text = p.lastName ?? '';
      _nicknameController.text = p.nickname ?? '';
      _slugController.text = p.slug;
      _avatarUrlController.text = p.avatarUrl ?? '';
      _notesController.text = p.notesMarkdown ?? '';
      _interestsController.text = p.interests.join(', ');
      _tagsController.text = p.tags.join(', ');

      _instagramController.text = p.socialLinks.instagram ?? '';
      _facebookController.text = p.socialLinks.facebook ?? '';
      _githubController.text = p.socialLinks.github ?? '';
      _linkedinController.text = p.socialLinks.linkedin ?? '';
      _websiteController.text = p.socialLinks.website ?? '';

      if (relationshipPresets.contains(p.relationshipType)) {
        _relationshipType = p.relationshipType;
      } else {
        _relationshipType = 'Custom';
        _customRelationshipController.text = p.relationshipType;
      }

      _visibility = p.visibility;
      _favorite = p.favorite;
      _importantDates = List.from(p.importantDates);
      _isAutoSlug = false;
    }
  }

  void _onDisplayNameChanged() {
    setState(() {}); // Dynamically update person header
    if (_isAutoSlug) {
      final text = _displayNameController.text.trim().toLowerCase();
      final slug = text
          .replaceAll(RegExp(r'[^\w\s-]'), '')
          .replaceAll(RegExp(r'[\s_-]+'), '-')
          .replaceAll(RegExp(r'^-+|-+$'), '');
      _slugController.text = slug;
    }
  }

  void _onCustomRelationshipChanged() {
    if (_relationshipType == 'Custom') {
      setState(() {}); // Dynamically update relationship subtitle in header
    }
  }

  String _getInitials() {
    final name = _displayNameController.text.trim();
    if (name.isEmpty) {
      return widget.personToEdit?.initials ?? '';
    }
    final parts = name.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '';
    if (parts.length == 1) {
      return parts[0].substring(0, 1).toUpperCase();
    }
    return '${parts[0].substring(0, 1)}${parts[1].substring(0, 1)}'.toUpperCase();
  }

  // Interests Chip List Helpers
  List<String> get _interestsList {
    return _interestsController.text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
  }

  void _addInterest(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return;
    final current = _interestsList;
    if (!current.contains(trimmed)) {
      current.add(trimmed);
      setState(() {
        _interestsController.text = current.join(', ');
      });
    }
  }

  void _removeInterest(String value) {
    final current = _interestsList;
    current.remove(value);
    setState(() {
      _interestsController.text = current.join(', ');
    });
  }

  // Tags Chip List Helpers
  List<String> get _tagsList {
    return _tagsController.text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
  }

  void _addTag(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return;
    final current = _tagsList;
    if (!current.contains(trimmed)) {
      current.add(trimmed);
      setState(() {
        _tagsController.text = current.join(', ');
      });
    }
  }

  void _removeTag(String value) {
    final current = _tagsList;
    current.remove(value);
    setState(() {
      _tagsController.text = current.join(', ');
    });
  }

  void _showAddChipDialog({
    required String title,
    required String placeholder,
    required ValueChanged<String> onAdd,
  }) {
    final textController = TextEditingController();
    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text(title),
        content: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: CupertinoTextField(
            controller: textController,
            autofocus: true,
            placeholder: placeholder,
            onSubmitted: (val) {
              Navigator.pop(ctx);
              onAdd(val);
            },
          ),
        ),
        actions: [
          CupertinoDialogAction(
            child: const Text('Cancel'),
            onPressed: () => Navigator.pop(ctx),
          ),
          CupertinoDialogAction(
            isDefaultAction: true,
            child: const Text('Add'),
            onPressed: () {
              Navigator.pop(ctx);
              onAdd(textController.text);
            },
          ),
        ],
      ),
    );
  }

  static String _formatDisplayDate(String dateStr) {
    if (dateStr.isEmpty) return 'Pick Date';
    try {
      final dt = DateTime.parse(dateStr);
      return DateFormat('MMM d, yyyy').format(dt);
    } catch (_) {
      return dateStr;
    }
  }

  static String _formatTimestamp(String? ts) {
    if (ts == null || ts.isEmpty) return '—';
    try {
      final dt = DateTime.parse(ts).toLocal();
      return DateFormat('MMM d, yyyy').format(dt);
    } catch (_) {
      return ts;
    }
  }

  @override
  void dispose() {
    _displayNameController.removeListener(_onDisplayNameChanged);
    _customRelationshipController.removeListener(_onCustomRelationshipChanged);
    _displayNameController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _nicknameController.dispose();
    _slugController.dispose();
    _avatarUrlController.dispose();
    _customRelationshipController.dispose();
    _notesController.dispose();
    _interestsController.dispose();
    _tagsController.dispose();
    _instagramController.dispose();
    _facebookController.dispose();
    _githubController.dispose();
    _linkedinController.dispose();
    _websiteController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadImage(ImageSource source) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: source, maxWidth: 800, imageQuality: 85);
    if (file == null) return;

    setState(() => _isUploadingAvatar = true);
    HapticFeedback.lightImpact();

    try {
      final bytes = await file.readAsBytes();
      final url = await ApiService.uploadAvatar(file.name, bytes);
      if (mounted) {
        setState(() {
          _avatarUrlController.text = url;
          _isUploadingAvatar = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isUploadingAvatar = false;
          _errorMessage = 'Avatar upload failed: ${e.toString()}';
        });
      }
    }
  }

  void _showAvatarOptions() {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => CupertinoActionSheet(
        title: const Text('Change Photo'),
        actions: [
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(ctx);
              _pickAndUploadImage(ImageSource.camera);
            },
            child: const Text('Take Photo with Camera'),
          ),
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(ctx);
              _pickAndUploadImage(ImageSource.gallery);
            },
            child: const Text('Choose from Photo Library'),
          ),
          if (_avatarUrlController.text.isNotEmpty)
            CupertinoActionSheetAction(
              isDestructiveAction: true,
              onPressed: () {
                Navigator.pop(ctx);
                setState(() => _avatarUrlController.clear());
              },
              child: const Text('Remove Photo'),
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

  void _addImportantDate() {
    final now = DateTime.now();
    final dateStr = DateFormat('yyyy-MM-dd').format(now);
    setState(() {
      _importantDates.add(
        ImportantDate(
          id: 'date_${DateTime.now().millisecondsSinceEpoch}',
          title: 'Birthday',
          date: dateStr,
          reminderEnabled: true,
        ),
      );
    });
  }

  void _pickDateForIndex(int index) {
    DateTime initial = DateTime.now();
    final curDateStr = _importantDates[index].date;
    if (curDateStr.isNotEmpty) {
      try {
        initial = DateTime.parse(curDateStr);
      } catch (_) {}
    }

    showCupertinoModalPopup(
      context: context,
      builder: (ctx) => Container(
        height: 280,
        color: CupertinoColors.systemBackground.resolveFrom(context),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  CupertinoButton(
                    padding: EdgeInsets.zero,
                    child: const Text('Cancel'),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                  CupertinoButton(
                    padding: EdgeInsets.zero,
                    child: const Text('Done', style: TextStyle(fontWeight: FontWeight.bold)),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
            ),
            Expanded(
              child: CupertinoDatePicker(
                mode: CupertinoDatePickerMode.date,
                initialDateTime: initial,
                maximumDate: DateTime(2100),
                minimumDate: DateTime(1900),
                onDateTimeChanged: (newDate) {
                  final formatted = DateFormat('yyyy-MM-dd').format(newDate);
                  setState(() {
                    final item = _importantDates[index];
                    _importantDates[index] = ImportantDate(
                      id: item.id,
                      title: item.title,
                      date: formatted,
                      reminderEnabled: item.reminderEnabled,
                      notes: item.notes,
                    );
                  });
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleSave() async {
    final displayName = _displayNameController.text.trim();
    if (displayName.isEmpty) {
      setState(() => _errorMessage = 'Display name is required.');
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });
    HapticFeedback.lightImpact();

    final finalRelationship = _relationshipType == 'Custom'
        ? (_customRelationshipController.text.trim().isNotEmpty
            ? _customRelationshipController.text.trim()
            : 'Contact')
        : _relationshipType;

    final interestsList = _interestsList;
    final tagsList = _tagsList;

    final socialLinksMap = {
      'instagram': _instagramController.text.trim(),
      'facebook': _facebookController.text.trim(),
      'github': _githubController.text.trim(),
      'linkedin': _linkedinController.text.trim(),
      'website': _websiteController.text.trim(),
    };

    final payload = {
      if (widget.personToEdit != null) 'id': widget.personToEdit!.id,
      'displayName': displayName,
      'firstName': _firstNameController.text.trim(),
      'lastName': _lastNameController.text.trim(),
      'nickname': _nicknameController.text.trim(),
      'slug': _slugController.text.trim(),
      'avatarUrl': _avatarUrlController.text.trim(),
      'relationshipType': finalRelationship,
      'importantDates': _importantDates.map((d) => d.toJson()).toList(),
      'notesMarkdown': _notesController.text.trim(),
      'interests': interestsList,
      'tags': tagsList,
      'socialLinks': socialLinksMap,
      'visibility': _visibility,
      'favorite': _favorite,
    };

    // Construct optimistic record and save locally immediately (works 100% offline)
    final tempId = widget.personToEdit?.id ?? 'temp_${DateTime.now().millisecondsSinceEpoch}';
    final optimisticPerson = PersonRecord(
      id: tempId,
      displayName: _displayNameController.text.trim(),
      firstName: _firstNameController.text.trim().isNotEmpty ? _firstNameController.text.trim() : null,
      lastName: _lastNameController.text.trim().isNotEmpty ? _lastNameController.text.trim() : null,
      nickname: _nicknameController.text.trim().isNotEmpty ? _nicknameController.text.trim() : null,
      slug: _slugController.text.trim().isNotEmpty ? _slugController.text.trim() : tempId,
      avatarUrl: _avatarUrlController.text.trim().isNotEmpty ? _avatarUrlController.text.trim() : null,
      relationshipType: finalRelationship,
      favorite: _favorite,
      visibility: _visibility,
      notesMarkdown: _notesController.text.trim(),
      interests: interestsList,
      tags: tagsList,
      importantDates: _importantDates,
      socialLinks: SocialLinks.fromJson(socialLinksMap),
      createdAt: widget.personToEdit?.createdAt ?? DateTime.now().toIso8601String(),
      updatedAt: DateTime.now().toIso8601String(),
    );

    await LocalStore.upsertCachedPerson(optimisticPerson);
    if (optimisticPerson.hasAvatar) {
      PeopleImageCacheManager.precacheImage(optimisticPerson.avatarUrl!);
    }

    try {
      PersonRecord savedPerson;
      if (widget.personToEdit != null) {
        savedPerson = await ApiService.updatePerson(widget.personToEdit!.id, payload);
      } else {
        savedPerson = await ApiService.savePerson(payload);
      }

      // Schedule reminders
      await NotificationService.scheduleRemindersForPerson(savedPerson);

      if (mounted) {
        widget.onSuccess();
        Navigator.of(context).pop();
      }
    } catch (e) {
      // Offline fallback: queue mutation (person is already saved to local cache)
      await SyncService.queueMutation(
        type: widget.personToEdit != null ? 'update_person' : 'create_person',
        entityId: widget.personToEdit?.id ?? tempId,
        payload: payload,
      );

      if (mounted) {
        widget.onSuccess();
        Navigator.of(context).pop();
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _confirmDelete() {
    if (widget.personToEdit == null) return;
    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Delete Contact'),
        content: Text('Are you sure you want to delete ${widget.personToEdit!.displayName}?'),
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
              // Optimistically delete from cache immediately
              await LocalStore.deleteCachedPerson(widget.personToEdit!.id);

              try {
                await ApiService.deletePerson(widget.personToEdit!.id);
              } catch (_) {
                await SyncService.queueMutation(
                  type: 'delete_person',
                  entityId: widget.personToEdit!.id,
                  payload: {},
                );
              }
              if (mounted) {
                widget.onSuccess();
                Navigator.of(context).pop();
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildChipRow({
    required List<String> items,
    required ValueChanged<String> onRemove,
    required VoidCallback onAdd,
    required String addLabel,
  }) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        ...items.map((item) {
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: AppCupertinoTheme.subtleFill.resolveFrom(context),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  item,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppCupertinoTheme.label(context),
                  ),
                ),
                const SizedBox(width: 4),
                GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    onRemove(item);
                  },
                  child: Icon(
                    CupertinoIcons.xmark,
                    size: 12,
                    color: AppCupertinoTheme.secondary(context),
                  ),
                ),
              ],
            ),
          );
        }),
        GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            onAdd();
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.35),
                width: 0.8,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  CupertinoIcons.plus,
                  size: 12,
                  color: AppCupertinoTheme.brandAccent,
                ),
                const SizedBox(width: 4),
                Text(
                  addLabel,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppCupertinoTheme.brandAccent,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);
    final tertiaryColor = AppCupertinoTheme.tertiary(context);

    final rawName = _displayNameController.text.trim();
    final headerName = rawName.isNotEmpty
        ? rawName
        : (widget.personToEdit != null ? widget.personToEdit!.displayName : 'New Contact');

    final headerRelationship = _relationshipType == 'Custom'
        ? (_customRelationshipController.text.trim().isNotEmpty
            ? _customRelationshipController.text.trim()
            : 'Custom')
        : _relationshipType;

    final initials = _getInitials();

    return CupertinoPageScaffold(
      backgroundColor: CupertinoColors.systemGroupedBackground,
      navigationBar: CupertinoNavigationBar(
        middle: Text(widget.personToEdit != null ? 'Edit Contact' : 'New Contact'),
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          child: const Text('Cancel'),
          onPressed: () => Navigator.of(context).pop(),
        ),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: _isSaving ? null : _handleSave,
          child: _isSaving
              ? const CupertinoActivityIndicator()
              : const Text(
                  'Save',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
        ),
      ),
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: 40),
          children: [
            // Error banner
            if (_errorMessage != null)
              Container(
                margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: CupertinoColors.systemRed.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: CupertinoColors.systemRed, fontSize: 13),
                  textAlign: TextAlign.center,
                ),
              ),

            // Profile Header: Focal Initials/Photo, Name, Relationship, Action
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
              child: Column(
                children: [
                  GestureDetector(
                    onTap: _showAvatarOptions,
                    child: Stack(
                      children: [
                        Container(
                          width: 86,
                          height: 86,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: AppCupertinoTheme.brandGradient,
                          ),
                          child: _avatarUrlController.text.isNotEmpty
                              ? ClipRRect(
                                  borderRadius: BorderRadius.circular(43),
                                  child: CachedNetworkImage(
                                    cacheManager: PeopleImageCacheManager.instance,
                                    imageUrl: _avatarUrlController.text,
                                    width: 86,
                                    height: 86,
                                    fit: BoxFit.cover,
                                    errorWidget: (_, _, _) => Center(
                                      child: Text(
                                        initials.isNotEmpty ? initials : '?',
                                        style: const TextStyle(
                                          color: CupertinoColors.white,
                                          fontSize: 28,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ),
                                )
                              : Center(
                                  child: initials.isNotEmpty
                                      ? Text(
                                          initials,
                                          style: const TextStyle(
                                            color: CupertinoColors.white,
                                            fontSize: 28,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        )
                                      : const Icon(
                                          CupertinoIcons.camera_fill,
                                          color: CupertinoColors.white,
                                          size: 34,
                                        ),
                                ),
                        ),
                        if (_isUploadingAvatar)
                          Positioned.fill(
                            child: Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: CupertinoColors.black.withValues(alpha: 0.5),
                              ),
                              child: const Center(
                                child: CupertinoActivityIndicator(color: CupertinoColors.white),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    headerName,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.4,
                      color: labelColor,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    headerRelationship,
                    style: TextStyle(
                      fontSize: 14,
                      color: secondaryColor,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  CupertinoButton(
                    padding: EdgeInsets.zero,
                    onPressed: _showAvatarOptions,
                    child: Text(
                      _avatarUrlController.text.isNotEmpty ? 'Change Photo' : 'Add Photo',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppCupertinoTheme.brandAccent,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Section 1: Basic Information
            CupertinoListSection.insetGrouped(
              header: const Text('BASIC INFORMATION'),
              children: [
                CupertinoTextFormFieldRow(
                  controller: _displayNameController,
                  prefix: const Text('Display name', style: TextStyle(fontSize: 15)),
                  placeholder: 'Required',
                ),
                CupertinoTextFormFieldRow(
                  controller: _firstNameController,
                  prefix: const Text('First name', style: TextStyle(fontSize: 15)),
                  placeholder: 'Given name',
                ),
                CupertinoTextFormFieldRow(
                  controller: _lastNameController,
                  prefix: const Text('Last name', style: TextStyle(fontSize: 15)),
                  placeholder: 'Family name',
                ),
                CupertinoTextFormFieldRow(
                  controller: _nicknameController,
                  prefix: const Text('Nickname', style: TextStyle(fontSize: 15)),
                  placeholder: '—',
                ),
              ],
            ),

            // Section 2: Relationship
            CupertinoListSection.insetGrouped(
              header: const Text('RELATIONSHIP'),
              children: [
                CupertinoListTile(
                  title: const Text('Relationship', style: TextStyle(fontSize: 15)),
                  trailing: CupertinoButton(
                    padding: EdgeInsets.zero,
                    onPressed: () {
                      showCupertinoModalPopup(
                        context: context,
                        builder: (ctx) => Container(
                          height: 240,
                          color: CupertinoColors.systemBackground.resolveFrom(context),
                          child: CupertinoPicker(
                            itemExtent: 36,
                            scrollController: FixedExtentScrollController(
                              initialItem: relationshipPresets.indexOf(_relationshipType),
                            ),
                            onSelectedItemChanged: (idx) {
                              setState(() => _relationshipType = relationshipPresets[idx]);
                            },
                            children: relationshipPresets.map((r) => Center(child: Text(r))).toList(),
                          ),
                        ),
                      );
                    },
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _relationshipType,
                          style: TextStyle(
                            fontSize: 15,
                            color: secondaryColor,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(
                          CupertinoIcons.chevron_right,
                          size: 14,
                          color: tertiaryColor,
                        ),
                      ],
                    ),
                  ),
                ),
                if (_relationshipType == 'Custom')
                  CupertinoTextFormFieldRow(
                    controller: _customRelationshipController,
                    prefix: const Text('Custom label', style: TextStyle(fontSize: 15)),
                    placeholder: 'e.g. Bandmate, Gym Buddy',
                  ),
                CupertinoListTile(
                  leading: Icon(
                    CupertinoIcons.star_fill,
                    size: 20,
                    color: _favorite ? AppCupertinoTheme.favoriteGold : CupertinoColors.systemGrey3,
                  ),
                  title: const Text('Favorite', style: TextStyle(fontSize: 15)),
                  trailing: CupertinoSwitch(
                    value: _favorite,
                    activeTrackColor: AppCupertinoTheme.favoriteGold,
                    onChanged: (val) => setState(() => _favorite = val),
                  ),
                ),
              ],
            ),

            // Section 3: Privacy
            CupertinoListSection.insetGrouped(
              header: const Text('PRIVACY'),
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Who can see this?',
                        style: TextStyle(
                          fontSize: 13,
                          color: secondaryColor,
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: CupertinoSlidingSegmentedControl<String>(
                          groupValue: _visibility,
                          onValueChanged: (val) {
                            if (val != null) setState(() => _visibility = val);
                          },
                          children: const {
                            'private': Padding(
                              padding: EdgeInsets.symmetric(vertical: 6),
                              child: Text('Private', style: TextStyle(fontSize: 13)),
                            ),
                            'unlisted': Padding(
                              padding: EdgeInsets.symmetric(vertical: 6),
                              child: Text('Unlisted', style: TextStyle(fontSize: 13)),
                            ),
                            'public': Padding(
                              padding: EdgeInsets.symmetric(vertical: 6),
                              child: Text('Public', style: TextStyle(fontSize: 13)),
                            ),
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // Section 4: Important Dates
            CupertinoListSection.insetGrouped(
              header: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('IMPORTANT DATES'),
                  CupertinoButton(
                    padding: EdgeInsets.zero,
                    onPressed: _addImportantDate,
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(CupertinoIcons.plus_circle_fill, size: 15, color: AppCupertinoTheme.brandAccent),
                        SizedBox(width: 4),
                        Text(
                          'Add Date',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppCupertinoTheme.brandAccent,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              children: _importantDates.isEmpty
                  ? [
                      CupertinoListTile(
                        title: Text('No dates added', style: TextStyle(color: secondaryColor, fontSize: 14)),
                        subtitle: Text('Tap "Add Date" to register birthdays or anniversaries', style: TextStyle(fontSize: 12, color: tertiaryColor)),
                      ),
                    ]
                  : _importantDates.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final dateItem = entry.value;
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: CupertinoTextField(
                                    placeholder: 'Title (e.g. Birthday)',
                                    controller: TextEditingController(text: dateItem.title)
                                      ..selection = TextSelection.collapsed(offset: dateItem.title.length),
                                    onChanged: (val) {
                                      _importantDates[idx] = ImportantDate(
                                        id: dateItem.id,
                                        title: val,
                                        date: dateItem.date,
                                        reminderEnabled: dateItem.reminderEnabled,
                                        notes: dateItem.notes,
                                      );
                                    },
                                    decoration: BoxDecoration(
                                      color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                    style: const TextStyle(fontSize: 14),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                CupertinoButton(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                                  borderRadius: BorderRadius.circular(8),
                                  onPressed: () => _pickDateForIndex(idx),
                                  child: Text(
                                    _formatDisplayDate(dateItem.date),
                                    style: TextStyle(fontSize: 13, color: labelColor, fontWeight: FontWeight.w500),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                CupertinoButton(
                                  padding: const EdgeInsets.all(4),
                                  onPressed: () {
                                    setState(() => _importantDates.removeAt(idx));
                                  },
                                  child: const Icon(CupertinoIcons.trash, color: CupertinoColors.systemRed, size: 18),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(CupertinoIcons.bell, size: 14, color: AppCupertinoTheme.accentRose),
                                const SizedBox(width: 6),
                                const Text('Device Notification', style: TextStyle(fontSize: 13)),
                                const Spacer(),
                                CupertinoSwitch(
                                  value: dateItem.reminderEnabled,
                                  activeTrackColor: AppCupertinoTheme.brandAccent,
                                  onChanged: (val) {
                                    setState(() {
                                      _importantDates[idx] = ImportantDate(
                                        id: dateItem.id,
                                        title: dateItem.title,
                                        date: dateItem.date,
                                        reminderEnabled: val,
                                        notes: dateItem.notes,
                                      );
                                    });
                                  },
                                ),
                              ],
                            ),
                            if (idx < _importantDates.length - 1)
                              Container(
                                height: 0.5,
                                color: AppCupertinoTheme.cardBorder.resolveFrom(context),
                                margin: const EdgeInsets.only(top: 10),
                              ),
                          ],
                        ),
                      );
                    }).toList(),
            ),

            // Section 5: Things to Remember
            CupertinoListSection.insetGrouped(
              header: const Text('THINGS TO REMEMBER'),
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Personal notes',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: labelColor,
                        ),
                      ),
                      const SizedBox(height: 8),
                      CupertinoTextField(
                        controller: _notesController,
                        placeholder: "Write something you'll want to remember later...",
                        placeholderStyle: TextStyle(
                          fontSize: 14,
                          color: secondaryColor,
                        ),
                        style: TextStyle(fontSize: 14, color: labelColor),
                        maxLines: 4,
                        minLines: 3,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Interests',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: labelColor,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _buildChipRow(
                        items: _interestsList,
                        onRemove: _removeInterest,
                        onAdd: () => _showAddChipDialog(
                          title: 'Add Interest',
                          placeholder: 'e.g. Photography, Hiking, Coffee',
                          onAdd: _addInterest,
                        ),
                        addLabel: 'Add',
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Tags',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: labelColor,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _buildChipRow(
                        items: _tagsList,
                        onRemove: _removeTag,
                        onAdd: () => _showAddChipDialog(
                          title: 'Add Tag',
                          placeholder: 'e.g. VIP, High school, Travel',
                          onAdd: _addTag,
                        ),
                        addLabel: 'Add',
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // Section 6: Social Profiles
            CupertinoListSection.insetGrouped(
              header: const Text('SOCIAL PROFILES'),
              children: [
                CupertinoTextFormFieldRow(
                  controller: _instagramController,
                  prefix: const Text('Instagram', style: TextStyle(fontSize: 15)),
                  placeholder: '@handle or profile URL',
                ),
                CupertinoTextFormFieldRow(
                  controller: _facebookController,
                  prefix: const Text('Facebook', style: TextStyle(fontSize: 15)),
                  placeholder: 'Username or profile URL',
                ),
                CupertinoTextFormFieldRow(
                  controller: _githubController,
                  prefix: const Text('GitHub', style: TextStyle(fontSize: 15)),
                  placeholder: 'Username',
                ),
                CupertinoTextFormFieldRow(
                  controller: _linkedinController,
                  prefix: const Text('LinkedIn', style: TextStyle(fontSize: 15)),
                  placeholder: 'Profile slug or URL',
                ),
                CupertinoTextFormFieldRow(
                  controller: _websiteController,
                  prefix: const Text('Website', style: TextStyle(fontSize: 15)),
                  placeholder: 'https://example.com',
                ),
              ],
            ),

            // Section 7: Advanced
            CupertinoListSection.insetGrouped(
              header: const Text('ADVANCED'),
              children: [
                CupertinoTextFormFieldRow(
                  controller: _slugController,
                  prefix: const Text('URL slug', style: TextStyle(fontSize: 15)),
                  placeholder: 'john-doe',
                  onChanged: (_) => _isAutoSlug = false,
                ),
                if (widget.personToEdit != null) ...[
                  CupertinoListTile(
                    title: const Text('Created', style: TextStyle(fontSize: 15)),
                    trailing: Text(
                      _formatTimestamp(widget.personToEdit!.createdAt),
                      style: TextStyle(fontSize: 14, color: secondaryColor),
                    ),
                  ),
                  CupertinoListTile(
                    title: const Text('Last updated', style: TextStyle(fontSize: 15)),
                    trailing: Text(
                      _formatTimestamp(widget.personToEdit!.updatedAt),
                      style: TextStyle(fontSize: 14, color: secondaryColor),
                    ),
                  ),
                ],
              ],
            ),

            // Destructive Action: Delete Contact (when editing)
            if (widget.personToEdit != null)
              CupertinoListSection.insetGrouped(
                children: [
                  CupertinoListTile(
                    title: const Center(
                      child: Text(
                        'Delete Contact',
                        style: TextStyle(
                          color: CupertinoColors.systemRed,
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    onTap: _confirmDelete,
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
