import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../core/models/trip_record.dart';
import '../core/network/api_service.dart';
import '../core/network/sync_service.dart';
import '../core/storage/local_store.dart';
import '../core/theme/cupertino_theme.dart';
import '../widgets/picker_sheet.dart';
import '../widgets/form_kit.dart';
import '../widgets/trip_status_badge.dart';

class TripFormModal extends StatefulWidget {
  final TripRecord? tripToEdit;
  final VoidCallback onSuccess;

  const TripFormModal({super.key, this.tripToEdit, required this.onSuccess});

  static Future<void> show(
    BuildContext context, {
    TripRecord? tripToEdit,
    required VoidCallback onSuccess,
  }) {
    return Navigator.of(context).push(
      CupertinoPageRoute(
        fullscreenDialog: true,
        builder: (_) => TripFormModal(tripToEdit: tripToEdit, onSuccess: onSuccess),
      ),
    );
  }

  @override
  State<TripFormModal> createState() => _TripFormModalState();
}

class _TripFormModalState extends State<TripFormModal> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _slugController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  final TextEditingController _tagsController = TextEditingController();

  String _status = 'planned';
  String _visibility = 'public';
  bool _favorite = false;
  String? _startDate;
  String? _endDate;

  bool _isAutoSlug = true;
  bool _isSaving = false;
  String? _errorMessage;

  static const List<String> statusPresets = ['planned', 'ongoing', 'completed', 'cancelled'];

  @override
  void initState() {
    super.initState();
    _populate();
    _titleController.addListener(_onTitleChanged);
  }

  void _populate() {
    final t = widget.tripToEdit;
    if (t != null) {
      _titleController.text = t.title;
      _slugController.text = t.slug;
      _descriptionController.text = t.description ?? '';
      _tagsController.text = t.tags.join(', ');
      _status = t.status;
      _visibility = t.visibility;
      _favorite = t.favorite;
      _startDate = t.startDate;
      _endDate = t.endDate;
      _isAutoSlug = false;
    }
  }

  void _onTitleChanged() {
    setState(() {});
    if (_isAutoSlug) {
      final text = _titleController.text.trim().toLowerCase();
      _slugController.text = text
          .replaceAll(RegExp(r'[^\w\s-]'), '')
          .replaceAll(RegExp(r'[\s_-]+'), '-')
          .replaceAll(RegExp(r'^-+|-+$'), '');
    }
  }

  List<String> get _tagsList => _tagsController.text
      .split(',')
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toList();

  @override
  void dispose() {
    _titleController.removeListener(_onTitleChanged);
    _titleController.dispose();
    _slugController.dispose();
    _descriptionController.dispose();
    _tagsController.dispose();
    super.dispose();
  }

  static String _formatDisplayDate(String? dateStr) {
    if (dateStr == null || dateStr.isEmpty) return 'Not set';
    try {
      return DateFormat('MMM d, yyyy').format(DateTime.parse(dateStr));
    } catch (_) {
      return dateStr;
    }
  }

  void _pickDate({required bool isStart}) {
    final current = isStart ? _startDate : _endDate;
    DateTime initial = DateTime.now();
    if (current != null && current.isNotEmpty) {
      try {
        initial = DateTime.parse(current);
      } catch (_) {}
    }

    showPremiumDateSheet(
      context,
      title: isStart ? 'Start date' : 'End date',
      initial: initial,
      onClear: () => setState(() {
        if (isStart) {
          _startDate = null;
        } else {
          _endDate = null;
        }
      }),
      onChanged: (newDate) {
        final formatted = DateFormat('yyyy-MM-dd').format(newDate);
        setState(() {
          if (isStart) {
            _startDate = formatted;
          } else {
            _endDate = formatted;
          }
        });
      },
    );
  }

  void _addTag(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return;
    final current = _tagsList;
    if (!current.contains(trimmed)) {
      current.add(trimmed);
      setState(() => _tagsController.text = current.join(', '));
    }
  }

  void _removeTag(String value) {
    final current = _tagsList..remove(value);
    setState(() => _tagsController.text = current.join(', '));
  }

  void _showAddTagDialog() {
    final controller = TextEditingController();
    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Add Tag'),
        content: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: CupertinoTextField(
            controller: controller,
            autofocus: true,
            placeholder: 'e.g. Beach, Roadtrip, 2026',
            onSubmitted: (val) {
              Navigator.pop(ctx);
              _addTag(val);
            },
          ),
        ),
        actions: [
          CupertinoDialogAction(child: const Text('Cancel'), onPressed: () => Navigator.pop(ctx)),
          CupertinoDialogAction(
            isDefaultAction: true,
            child: const Text('Add'),
            onPressed: () {
              Navigator.pop(ctx);
              _addTag(controller.text);
            },
          ),
        ],
      ),
    );
  }

  Future<void> _handleSave() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      setState(() => _errorMessage = 'Trip title is required.');
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });
    HapticFeedback.lightImpact();

    final tagsList = _tagsList;
    final slug = _slugController.text.trim();
    final description = _descriptionController.text.trim();

    final payload = <String, dynamic>{
      if (widget.tripToEdit != null) 'id': widget.tripToEdit!.id,
      'title': title,
      'slug': slug,
      'description': description,
      'startDate': _startDate,
      'endDate': _endDate,
      'status': _status,
      'visibility': _visibility,
      'favorite': _favorite,
      'tags': tagsList,
    };

    final tempId = widget.tripToEdit?.id ?? 'temp_${DateTime.now().millisecondsSinceEpoch}';
    final optimistic = TripRecord(
      id: tempId,
      slug: slug.isNotEmpty ? slug : tempId,
      title: title,
      displayTitle: title,
      description: description.isNotEmpty ? description : null,
      startDate: _startDate,
      endDate: _endDate,
      status: _status,
      visibility: _visibility,
      favorite: _favorite,
      tags: tagsList,
      createdAt: widget.tripToEdit?.createdAt ?? DateTime.now().toIso8601String(),
      updatedAt: DateTime.now().toIso8601String(),
    );

    await LocalStore.upsertCachedTrip(optimistic);

    try {
      if (widget.tripToEdit != null) {
        await ApiService.updateTrip(widget.tripToEdit!.id, payload);
      } else {
        final saved = await ApiService.saveTrip(payload);
        if (tempId != saved.id) {
          await LocalStore.deleteCachedTrip(tempId);
        }
      }
      if (mounted) {
        widget.onSuccess();
        Navigator.of(context).pop();
      }
    } catch (_) {
      await SyncService.queueMutation(
        type: widget.tripToEdit != null ? 'update_trip' : 'create_trip',
        entityId: widget.tripToEdit?.id ?? tempId,
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
    if (widget.tripToEdit == null) return;
    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Delete Trip'),
        content: Text('Delete "${widget.tripToEdit!.title}"?'),
        actions: [
          CupertinoDialogAction(child: const Text('Cancel'), onPressed: () => Navigator.pop(ctx)),
          CupertinoDialogAction(
            isDestructiveAction: true,
            child: const Text('Delete'),
            onPressed: () async {
              Navigator.pop(ctx);
              await LocalStore.deleteCachedTrip(widget.tripToEdit!.id);
              try {
                await ApiService.deleteTrip(widget.tripToEdit!.id);
              } catch (_) {
                await SyncService.queueMutation(
                  type: 'delete_trip',
                  entityId: widget.tripToEdit!.id,
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

  Widget _buildChipRow() {
    final items = _tagsList;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
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
                Text(item,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppCupertinoTheme.label(context))),
                const SizedBox(width: 4),
                GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    _removeTag(item);
                  },
                  child: Icon(CupertinoIcons.xmark, size: 12, color: AppCupertinoTheme.secondary(context)),
                ),
              ],
            ),
          );
        }),
        GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            _showAddTagDialog();
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.35), width: 0.8),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(CupertinoIcons.plus, size: 12, color: AppCupertinoTheme.brandAccent),
                SizedBox(width: 4),
                Text('Add', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppCupertinoTheme.brandAccent)),
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

    return CupertinoPageScaffold(
      backgroundColor: CupertinoColors.systemGroupedBackground,
      navigationBar: CupertinoNavigationBar(
        middle: Text(widget.tripToEdit != null ? 'Edit Trip' : 'New Trip'),
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
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
          padding: const EdgeInsets.only(top: 4, bottom: 44),
          children: [
            if (_errorMessage != null)
              Container(
                margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: CupertinoColors.systemRed.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(_errorMessage!,
                    style: const TextStyle(color: CupertinoColors.systemRed, fontSize: 13),
                    textAlign: TextAlign.center),
              ),

            // TRIP
            formSectionLabel(context, 'Trip'),
            formCard(context, children: [
              formInlineField(context,
                  label: 'Title',
                  field: formInput(context, _titleController, placeholder: 'Required')),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Text('DESCRIPTION',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5, color: secondaryColor)),
              ),
              formTextArea(context, _descriptionController, placeholder: 'What was this trip about?'),
            ]),

            // DATES
            formSectionLabel(context, 'Dates'),
            formCard(context, children: [
              formTapRow(context,
                  label: 'Start date',
                  value: _formatDisplayDate(_startDate),
                  muted: _startDate == null,
                  onTap: () => _pickDate(isStart: true)),
              formTapRow(context,
                  label: 'End date',
                  value: _formatDisplayDate(_endDate),
                  muted: _endDate == null,
                  onTap: () => _pickDate(isStart: false)),
            ]),

            // STATUS
            formSectionLabel(context, 'Status'),
            formCard(context, children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                child: OptionChipGrid(
                  selected: _status,
                  onSelect: (v) => setState(() => _status = v),
                  options: statusPresets.map((s) {
                    final style = TripStatusBadge.styleFor(s);
                    return OptionChipData(s, style.label, icon: style.icon);
                  }).toList(),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Icon(CupertinoIcons.star_fill,
                        size: 18, color: _favorite ? AppCupertinoTheme.favoriteGold : CupertinoColors.systemGrey3),
                    const SizedBox(width: 10),
                    Text('Favorite', style: TextStyle(fontSize: 15, color: labelColor)),
                    const Spacer(),
                    CupertinoSwitch(
                      value: _favorite,
                      activeTrackColor: AppCupertinoTheme.favoriteGold,
                      onChanged: (val) => setState(() => _favorite = val),
                    ),
                  ],
                ),
              ),
            ]),

            // VISIBILITY
            formSectionLabel(context, 'Visibility'),
            formCard(context, children: [
              Padding(
                padding: const EdgeInsets.all(14),
                child: SizedBox(
                  width: double.infinity,
                  child: CupertinoSlidingSegmentedControl<String>(
                    groupValue: _visibility,
                    onValueChanged: (val) {
                      if (val != null) setState(() => _visibility = val);
                    },
                    children: const {
                      'private': Padding(padding: EdgeInsets.symmetric(vertical: 7), child: Text('Private', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                      'unlisted': Padding(padding: EdgeInsets.symmetric(vertical: 7), child: Text('Unlisted', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                      'public': Padding(padding: EdgeInsets.symmetric(vertical: 7), child: Text('Public', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                    },
                  ),
                ),
              ),
            ]),

            // TAGS
            formSectionLabel(context, 'Tags'),
            formCard(context, children: [
              Padding(
                padding: const EdgeInsets.all(14),
                child: _buildChipRow(),
              ),
            ]),

            // ADVANCED
            formSectionLabel(context, 'Advanced'),
            formCard(context, children: [
              formInlineField(context,
                  label: 'URL slug',
                  field: formInput(context, _slugController,
                      placeholder: 'summer-trip', onChanged: (_) => _isAutoSlug = false)),
            ]),

            if (widget.tripToEdit != null) ...[
              const SizedBox(height: 20),
              formCard(context, children: [
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: _confirmDelete,
                  child: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 15),
                    child: Center(
                      child: Text('Delete Trip',
                          style: TextStyle(color: CupertinoColors.systemRed, fontWeight: FontWeight.w600, fontSize: 16)),
                    ),
                  ),
                ),
              ]),
            ],
          ],
        ),
      ),
    );
  }
}
