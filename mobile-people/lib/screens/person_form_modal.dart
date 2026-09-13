import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../core/models/person_record.dart';
import '../core/models/important_date.dart';
import '../core/network/api_service.dart';
import '../core/network/sync_service.dart';
import '../core/services/notification_service.dart';
import '../core/theme/liquid_glass_theme.dart';

class PersonFormModal extends StatefulWidget {
  final PersonRecord? personToEdit;
  final VoidCallback onSuccess;

  const PersonFormModal({
    super.key,
    this.personToEdit,
    required this.onSuccess,
  });

  static Future<void> show(BuildContext context, {PersonRecord? personToEdit, required VoidCallback onSuccess}) {
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
    } else {
      _displayNameController.addListener(_onDisplayNameChanged);
    }
  }

  void _onDisplayNameChanged() {
    if (_isAutoSlug) {
      final text = _displayNameController.text.trim().toLowerCase();
      final slug = text
          .replaceAll(RegExp(r'[^\w\s-]'), '')
          .replaceAll(RegExp(r'[\s_-]+'), '-')
          .replaceAll(RegExp(r'^-+|-+$'), '');
      _slugController.text = slug;
    }
  }

  @override
  void dispose() {
    _displayNameController.removeListener(_onDisplayNameChanged);
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
        title: const Text('Change Avatar Photo'),
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

    final interestsList = _interestsController.text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();

    final tagsList = _tagsController.text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();

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
      // Offline fallback: queue mutation
      await SyncService.queueMutation(
        type: widget.personToEdit != null ? 'update_person' : 'create_person',
        entityId: widget.personToEdit?.id ?? '',
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

  @override
  Widget build(BuildContext context) {
    final isDark = LiquidGlassTheme.isDark(context);

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
              : const Text('Save', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
      ),
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: 40),
          children: [
            // Error banner
            if (_errorMessage != null)
              Container(
                margin: const EdgeInsets.all(16),
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

            // Top Avatar Photo Selector
            const SizedBox(height: 16),
            Center(
              child: Stack(
                children: [
                  GestureDetector(
                    onTap: _showAvatarOptions,
                    child: Container(
                      width: 86,
                      height: 86,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [Color(0xFF8B5CF6), Color(0xFFEC4899)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF8B5CF6).withValues(alpha: 0.35),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: _avatarUrlController.text.isNotEmpty
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(43),
                              child: Image.network(
                                _avatarUrlController.text,
                                width: 86,
                                height: 86,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => const Icon(
                                  CupertinoIcons.person_fill,
                                  color: CupertinoColors.white,
                                  size: 44,
                                ),
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
            const SizedBox(height: 8),
            Center(
              child: CupertinoButton(
                padding: EdgeInsets.zero,
                onPressed: _showAvatarOptions,
                child: const Text('Add / Change Photo', style: TextStyle(fontSize: 13)),
              ),
            ),

            // Section 1: Basic Information
            CupertinoListSection.insetGrouped(
              header: const Text('BASIC INFORMATION'),
              children: [
                CupertinoTextFormFieldRow(
                  controller: _displayNameController,
                  prefix: const Text('Display Name *', style: TextStyle(fontSize: 15)),
                  placeholder: 'Full name or callsign',
                ),
                CupertinoTextFormFieldRow(
                  controller: _firstNameController,
                  prefix: const Text('First Name', style: TextStyle(fontSize: 15)),
                  placeholder: 'Given name',
                ),
                CupertinoTextFormFieldRow(
                  controller: _lastNameController,
                  prefix: const Text('Last Name', style: TextStyle(fontSize: 15)),
                  placeholder: 'Family name',
                ),
                CupertinoTextFormFieldRow(
                  controller: _nicknameController,
                  prefix: const Text('Nickname', style: TextStyle(fontSize: 15)),
                  placeholder: 'Alias / pet name',
                ),
                CupertinoTextFormFieldRow(
                  controller: _slugController,
                  prefix: const Text('URL Slug', style: TextStyle(fontSize: 15)),
                  placeholder: 'john-doe',
                  onChanged: (_) => _isAutoSlug = false,
                ),
              ],
            ),

            // Section 2: Relationship & Visibility
            CupertinoListSection.insetGrouped(
              header: const Text('RELATIONSHIP & VISIBILITY'),
              children: [
                // Relationship Preset Selector
                CupertinoListTile(
                  title: const Text('Relationship'),
                  trailing: CupertinoButton(
                    padding: EdgeInsets.zero,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_relationshipType, style: const TextStyle(fontSize: 15)),
                        const Icon(CupertinoIcons.chevron_up_chevron_down, size: 14),
                      ],
                    ),
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
                  ),
                ),
                if (_relationshipType == 'Custom')
                  CupertinoTextFormFieldRow(
                    controller: _customRelationshipController,
                    prefix: const Text('Custom Label', style: TextStyle(fontSize: 15)),
                    placeholder: 'e.g. Bandmate, Gym Buddy',
                  ),

                // Visibility Selector
                CupertinoListTile(
                  title: const Text('Visibility'),
                  trailing: CupertinoSlidingSegmentedControl<String>(
                    groupValue: _visibility,
                    onValueChanged: (val) {
                      if (val != null) setState(() => _visibility = val);
                    },
                    children: const {
                      'private': Text('Private', style: TextStyle(fontSize: 11)),
                      'unlisted': Text('Unlisted', style: TextStyle(fontSize: 11)),
                      'public': Text('Public', style: TextStyle(fontSize: 11)),
                    },
                  ),
                ),

                // Favorite Switch
                CupertinoListTile(
                  title: const Text('Favorite Contact'),
                  leading: Icon(
                    CupertinoIcons.star_fill,
                    color: _favorite ? const Color(0xFFF59E0B) : CupertinoColors.systemGrey,
                  ),
                  trailing: CupertinoSwitch(
                    value: _favorite,
                    onChanged: (val) => setState(() => _favorite = val),
                  ),
                ),
              ],
            ),

            // Section 3: Important Dates & Reminders
            CupertinoListSection.insetGrouped(
              header: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('IMPORTANT DATES & REMINDERS'),
                  CupertinoButton(
                    padding: EdgeInsets.zero,
                    onPressed: _addImportantDate,
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(CupertinoIcons.plus_circle_fill, size: 16),
                        SizedBox(width: 4),
                        Text('Add Date', style: TextStyle(fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),
              children: _importantDates.isEmpty
                  ? [
                      const CupertinoListTile(
                        title: Text('No dates added', style: TextStyle(color: CupertinoColors.secondaryLabel)),
                        subtitle: Text('Tap "Add Date" to register birthdays or anniversaries', style: TextStyle(fontSize: 12)),
                      ),
                    ]
                  : _importantDates.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final dateItem = entry.value;
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: CupertinoTextField(
                                    placeholder: 'Title (e.g. Birthday, Anniversary)',
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
                                      color: isDark ? const Color(0x25FFFFFF) : const Color(0x10000000),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                CupertinoButton(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  color: isDark ? const Color(0x35FFFFFF) : const Color(0x15000000),
                                  borderRadius: BorderRadius.circular(8),
                                  onPressed: () => _pickDateForIndex(idx),
                                  child: Text(
                                    dateItem.date.isNotEmpty ? dateItem.date : 'Pick Date',
                                    style: const TextStyle(fontSize: 13, color: CupertinoColors.label),
                                  ),
                                ),
                                CupertinoButton(
                                  padding: EdgeInsets.zero,
                                  onPressed: () {
                                    setState(() => _importantDates.removeAt(idx));
                                  },
                                  child: const Icon(CupertinoIcons.trash, color: CupertinoColors.systemRed, size: 18),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(CupertinoIcons.bell, size: 14, color: Color(0xFFEC4899)),
                                const SizedBox(width: 6),
                                const Text('Device Notification', style: TextStyle(fontSize: 12)),
                                const Spacer(),
                                CupertinoSwitch(
                                  value: dateItem.reminderEnabled,
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
                              Container(height: 0.5, color: CupertinoColors.separator, margin: const EdgeInsets.only(top: 8)),
                          ],
                        ),
                      );
                    }).toList(),
            ),

            // Section 4: Notes & Interests
            CupertinoListSection.insetGrouped(
              header: const Text('MEMORIES & TOPICS'),
              children: [
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Personal Notes (Markdown)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 6),
                      CupertinoTextField(
                        controller: _notesController,
                        placeholder: 'Write personal gift ideas, stories, or memories...',
                        maxLines: 4,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          color: isDark ? const Color(0x25FFFFFF) : const Color(0x10000000),
                        ),
                        padding: const EdgeInsets.all(10),
                      ),
                    ],
                  ),
                ),
                CupertinoTextFormFieldRow(
                  controller: _interestsController,
                  prefix: const Text('Interests', style: TextStyle(fontSize: 15)),
                  placeholder: 'e.g. Photography, Hiking, Coffee',
                ),
                CupertinoTextFormFieldRow(
                  controller: _tagsController,
                  prefix: const Text('Tags', style: TextStyle(fontSize: 15)),
                  placeholder: 'e.g. vip, highschool, travel',
                ),
              ],
            ),

            // Section 5: Social Profiles
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
          ],
        ),
      ),
    );
  }
}
