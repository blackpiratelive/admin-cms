import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/models/trip_day.dart';
import '../core/network/api_service.dart';
import '../core/services/image_cache_manager.dart';
import '../core/theme/cupertino_theme.dart';
import 'photo_picker_modal.dart';
import 'trip_day_entry_editors.dart';

/// Full editor for a single itinerary day (writes via PUT /api/trips/[id]/days/[dayId]).
class TripDayEditorModal extends StatefulWidget {
  final String tripId;
  final TripDay day;
  final VoidCallback onSaved;

  const TripDayEditorModal({
    super.key,
    required this.tripId,
    required this.day,
    required this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required String tripId,
    required TripDay day,
    required VoidCallback onSaved,
  }) {
    return Navigator.of(context).push(
      CupertinoPageRoute(
        fullscreenDialog: true,
        builder: (_) => TripDayEditorModal(tripId: tripId, day: day, onSaved: onSaved),
      ),
    );
  }

  @override
  State<TripDayEditorModal> createState() => _TripDayEditorModalState();
}

class _TripDayEditorModalState extends State<TripDayEditorModal> {
  late final TextEditingController _titleController;
  late final TextEditingController _placeController;
  late final TextEditingController _weatherController;
  late final TextEditingController _notesController;
  late final TextEditingController _stayNameController;
  late final TextEditingController _stayCostController;
  late final TextEditingController _stayCurrencyController;

  String? _date;
  int? _mood;
  List<TransportLeg> _transport = [];
  List<MealEntry> _meals = [];
  List<ActivityEntry> _activities = [];
  List<DayPhoto> _photos = [];

  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final d = widget.day;
    _titleController = TextEditingController(text: d.title ?? '');
    _placeController = TextEditingController(text: d.primaryLocationName ?? '');
    _weatherController = TextEditingController(text: d.weather ?? '');
    _notesController = TextEditingController(text: d.notesMarkdown ?? '');
    _stayNameController = TextEditingController(text: d.accommodation.name ?? '');
    _stayCostController = TextEditingController(
        text: d.accommodation.cost != null ? d.accommodation.cost.toString() : '');
    _stayCurrencyController = TextEditingController(text: d.accommodation.currency ?? '');
    _date = d.date;
    _mood = d.mood;
    _transport = List.of(d.transport);
    _meals = List.of(d.meals);
    _activities = List.of(d.activities);
    _photos = List.of(d.photos);
  }

  @override
  void dispose() {
    _titleController.dispose();
    _placeController.dispose();
    _weatherController.dispose();
    _notesController.dispose();
    _stayNameController.dispose();
    _stayCostController.dispose();
    _stayCurrencyController.dispose();
    super.dispose();
  }

  static String genId(String prefix) =>
      '${prefix}_${DateTime.now().microsecondsSinceEpoch}';

  Future<void> _handleSave() async {
    setState(() => _isSaving = true);
    HapticFeedback.lightImpact();

    final costText = _stayCostController.text.trim();
    final accommodation = Accommodation(
      name: _stayNameController.text.trim().isEmpty ? null : _stayNameController.text.trim(),
      locationName: widget.day.accommodation.locationName,
      cost: costText.isEmpty ? null : num.tryParse(costText),
      currency: _stayCurrencyController.text.trim().isEmpty ? null : _stayCurrencyController.text.trim(),
      notes: widget.day.accommodation.notes,
    );

    final edited = TripDay(
      id: widget.day.id,
      tripId: widget.day.tripId,
      dayNumber: widget.day.dayNumber,
      date: _date,
      title: _titleController.text.trim().isEmpty ? null : _titleController.text.trim(),
      primaryLocationName: _placeController.text.trim().isEmpty ? null : _placeController.text.trim(),
      transport: _transport,
      meals: _meals,
      activities: _activities,
      accommodation: accommodation,
      photos: _photos,
      weather: _weatherController.text.trim().isEmpty ? null : _weatherController.text.trim(),
      mood: _mood,
      notesMarkdown: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
    );

    try {
      await ApiService.updateTripDay(widget.tripId, widget.day.id, edited.toUpdateJson());
      if (mounted) {
        widget.onSaved();
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        showCupertinoDialog<void>(
          context: context,
          builder: (ctx) => CupertinoAlertDialog(
            title: const Text('Could not save'),
            content: Text('$e'),
            actions: [
              CupertinoDialogAction(isDefaultAction: true, onPressed: () => Navigator.pop(ctx), child: const Text('OK')),
            ],
          ),
        );
      }
    }
  }

  void _pickDate() {
    DateTime initial = DateTime.now();
    if (_date != null && _date!.isNotEmpty) {
      try {
        initial = DateTime.parse(_date!);
      } catch (_) {}
    }
    showCupertinoModalPopup(
      context: context,
      builder: (ctx) => Container(
        height: 300,
        color: CupertinoColors.systemBackground.resolveFrom(context),
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: CupertinoButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Done', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
            Expanded(
              child: CupertinoDatePicker(
                mode: CupertinoDatePickerMode.date,
                initialDateTime: initial,
                minimumDate: DateTime(1990),
                maximumDate: DateTime(2100),
                onDateTimeChanged: (d) =>
                    setState(() => _date = DateFormat('yyyy-MM-dd').format(d)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _addPhotos() async {
    await PhotoPickerModal.showGeneric(
      context,
      headerTitle: 'Day ${widget.day.dayNumber}',
      defaultVerb: 'day_photo',
      onConnect: (photos, _) async {
        // Day photos live inside the day's JSON, so just append the URLs locally;
        // they persist when the day is saved.
        setState(() {
          for (final p in photos) {
            final url = p['url'] as String?;
            if (url != null && url.isNotEmpty) {
              _photos.add(DayPhoto(id: genId('photo'), url: url, caption: p['title'] as String?));
            }
          }
        });
        return true;
      },
      onSuccess: () {},
    );
  }

  Widget _sectionHeader(String title, VoidCallback onAdd) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title),
        CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: onAdd,
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(CupertinoIcons.plus_circle_fill, size: 15, color: AppCupertinoTheme.brandAccent),
              SizedBox(width: 4),
              Text('Add', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppCupertinoTheme.brandAccent)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _entryRow(String label, String? trailing, VoidCallback onEdit, VoidCallback onDelete) {
    return CupertinoListTile(
      title: Text(label, style: const TextStyle(fontSize: 15)),
      subtitle: trailing != null && trailing.isNotEmpty
          ? Text(trailing, style: TextStyle(fontSize: 12.5, color: AppCupertinoTheme.secondary(context)))
          : null,
      onTap: onEdit,
      trailing: CupertinoButton(
        padding: const EdgeInsets.all(4),
        minimumSize: Size.zero,
        onPressed: onDelete,
        child: const Icon(CupertinoIcons.trash, size: 18, color: CupertinoColors.systemRed),
      ),
    );
  }

  Widget _emptyRow(String text) => CupertinoListTile(
        title: Text(text, style: TextStyle(fontSize: 14, color: AppCupertinoTheme.secondary(context))),
      );

  @override
  Widget build(BuildContext context) {
    final secondary = AppCupertinoTheme.secondary(context);

    return CupertinoPageScaffold(
      backgroundColor: CupertinoColors.systemGroupedBackground,
      navigationBar: CupertinoNavigationBar(
        middle: Text('Day ${widget.day.dayNumber}'),
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
          padding: const EdgeInsets.only(bottom: 40),
          children: [
            CupertinoListSection.insetGrouped(
              header: const Text('OVERVIEW'),
              children: [
                CupertinoListTile(
                  title: const Text('Date', style: TextStyle(fontSize: 15)),
                  trailing: CupertinoButton(
                    padding: EdgeInsets.zero,
                    onPressed: _pickDate,
                    child: Text(_date ?? 'Not set', style: TextStyle(fontSize: 15, color: secondary)),
                  ),
                ),
                CupertinoTextFormFieldRow(controller: _titleController, prefix: const Text('Title'), placeholder: 'Day title'),
                CupertinoTextFormFieldRow(controller: _placeController, prefix: const Text('Place'), placeholder: 'Primary location'),
                CupertinoTextFormFieldRow(controller: _weatherController, prefix: const Text('Weather'), placeholder: 'e.g. Sunny'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      Text('Mood', style: TextStyle(fontSize: 15, color: AppCupertinoTheme.label(context))),
                      const Spacer(),
                      ...List.generate(5, (i) {
                        final value = i + 1;
                        final selected = _mood == value;
                        return GestureDetector(
                          onTap: () => setState(() => _mood = selected ? null : value),
                          child: Container(
                            margin: const EdgeInsets.only(left: 6),
                            width: 30,
                            height: 30,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: selected ? AppCupertinoTheme.brandAccent : AppCupertinoTheme.subtleFill.resolveFrom(context),
                            ),
                            child: Text('$value',
                                style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: selected ? CupertinoColors.white : AppCupertinoTheme.label(context))),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
              ],
            ),

            // Transport
            CupertinoListSection.insetGrouped(
              header: _sectionHeader('TRANSPORT', () async {
                final leg = await editTransportLeg(context, TransportLeg(id: genId('leg')));
                if (leg != null) setState(() => _transport.add(leg));
              }),
              children: _transport.isEmpty
                  ? [_emptyRow('No transport legs')]
                  : _transport.map((leg) {
                      return _entryRow(
                        leg.routeLabel.isNotEmpty ? '${leg.mode}: ${leg.routeLabel}' : leg.mode,
                        formatCostTotals(leg.cost != null ? {(leg.currency ?? '').trim(): leg.cost!} : {}),
                        () async {
                          final updated = await editTransportLeg(context, leg);
                          if (updated != null) {
                            setState(() {
                              final i = _transport.indexWhere((l) => l.id == leg.id);
                              if (i != -1) _transport[i] = updated;
                            });
                          }
                        },
                        () => setState(() => _transport.removeWhere((l) => l.id == leg.id)),
                      );
                    }).toList(),
            ),

            // Food
            CupertinoListSection.insetGrouped(
              header: _sectionHeader('FOOD', () async {
                final meal = await editMeal(context, MealEntry(id: genId('meal')));
                if (meal != null) setState(() => _meals.add(meal));
              }),
              children: _meals.isEmpty
                  ? [_emptyRow('No meals')]
                  : _meals.map((meal) {
                      final label = [meal.type, if (meal.place != null && meal.place!.isNotEmpty) meal.place].join(' · ');
                      return _entryRow(
                        label,
                        formatCostTotals(meal.cost != null ? {(meal.currency ?? '').trim(): meal.cost!} : {}),
                        () async {
                          final updated = await editMeal(context, meal);
                          if (updated != null) {
                            setState(() {
                              final i = _meals.indexWhere((m) => m.id == meal.id);
                              if (i != -1) _meals[i] = updated;
                            });
                          }
                        },
                        () => setState(() => _meals.removeWhere((m) => m.id == meal.id)),
                      );
                    }).toList(),
            ),

            // Activities
            CupertinoListSection.insetGrouped(
              header: _sectionHeader('ACTIVITIES', () async {
                final act = await editActivity(context, ActivityEntry(id: genId('act')));
                if (act != null && act.title.isNotEmpty) setState(() => _activities.add(act));
              }),
              children: _activities.isEmpty
                  ? [_emptyRow('No activities')]
                  : _activities.map((act) {
                      return _entryRow(
                        act.title.isNotEmpty ? act.title : 'Activity',
                        formatCostTotals(act.cost != null ? {(act.currency ?? '').trim(): act.cost!} : {}),
                        () async {
                          final updated = await editActivity(context, act);
                          if (updated != null) {
                            setState(() {
                              final i = _activities.indexWhere((a) => a.id == act.id);
                              if (i != -1) _activities[i] = updated;
                            });
                          }
                        },
                        () => setState(() => _activities.removeWhere((a) => a.id == act.id)),
                      );
                    }).toList(),
            ),

            // Stay
            CupertinoListSection.insetGrouped(
              header: const Text('STAY'),
              children: [
                CupertinoTextFormFieldRow(controller: _stayNameController, prefix: const Text('Hotel'), placeholder: 'Accommodation name'),
                CupertinoTextFormFieldRow(controller: _stayCostController, prefix: const Text('Cost'), placeholder: '0', keyboardType: const TextInputType.numberWithOptions(decimal: true)),
                CupertinoTextFormFieldRow(controller: _stayCurrencyController, prefix: const Text('Currency'), placeholder: '₹ / \$ / €'),
              ],
            ),

            // Notes
            CupertinoListSection.insetGrouped(
              header: const Text('NOTES'),
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: CupertinoTextField(
                    controller: _notesController,
                    placeholder: 'Markdown notes for the day...',
                    maxLines: 5,
                    minLines: 3,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ],
            ),

            // Photos
            CupertinoListSection.insetGrouped(
              header: _sectionHeader('PHOTOS', _addPhotos),
              children: [
                if (_photos.isEmpty)
                  _emptyRow('No photos')
                else
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _photos.map((p) {
                        return Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: CachedNetworkImage(
                                cacheManager: PeopleImageCacheManager.instance,
                                imageUrl: p.url,
                                width: 76,
                                height: 76,
                                fit: BoxFit.cover,
                                errorWidget: (_, _, _) => Container(
                                  width: 76,
                                  height: 76,
                                  color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                                  child: const Icon(CupertinoIcons.photo, color: CupertinoColors.systemGrey),
                                ),
                              ),
                            ),
                            Positioned(
                              top: -6,
                              right: -6,
                              child: CupertinoButton(
                                padding: const EdgeInsets.all(4),
                                minimumSize: Size.zero,
                                onPressed: () => setState(() => _photos.remove(p)),
                                child: const Icon(CupertinoIcons.minus_circle_fill, size: 20, color: CupertinoColors.systemRed),
                              ),
                            ),
                          ],
                        );
                      }).toList(),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
