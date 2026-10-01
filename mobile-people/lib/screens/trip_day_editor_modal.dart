import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/models/trip_day.dart';
import '../core/network/api_service.dart';
import '../core/services/image_cache_manager.dart';
import '../core/theme/cupertino_theme.dart';
import '../widgets/picker_sheet.dart';
import '../widgets/form_kit.dart';
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
    showPremiumDateSheet(
      context,
      title: 'Day date',
      initial: initial,
      onClear: () => setState(() => _date = null),
      onChanged: (d) => setState(() => _date = DateFormat('yyyy-MM-dd').format(d)),
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

  Widget _addButton(VoidCallback onAdd) {
    return CupertinoButton(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      minimumSize: Size.zero,
      onPressed: onAdd,
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(CupertinoIcons.add, size: 15, color: AppCupertinoTheme.brandAccent),
          SizedBox(width: 3),
          Text('Add', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppCupertinoTheme.brandAccent)),
        ],
      ),
    );
  }

  static const Map<String, IconData> _modeIcons = {
    'walk': CupertinoIcons.person,
    'bike': CupertinoIcons.cube_box,
    'bus': CupertinoIcons.bus,
    'train': CupertinoIcons.tram_fill,
    'flight': CupertinoIcons.airplane,
    'car': CupertinoIcons.car_detailed,
    'taxi': CupertinoIcons.car,
    'boat': CupertinoIcons.drop,
    'other': CupertinoIcons.arrow_right,
  };

  Widget _premiumEntryRow({
    required IconData icon,
    required String title,
    String? subtitle,
    String? cost,
    required VoidCallback onEdit,
    required VoidCallback onDelete,
  }) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondary = AppCupertinoTheme.secondary(context);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onEdit,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 17, color: AppCupertinoTheme.brandAccent),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: labelColor)),
                  if (subtitle != null && subtitle.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12.5, color: secondary)),
                    ),
                ],
              ),
            ),
            if (cost != null && cost.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(cost, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: labelColor)),
              ),
            ],
            CupertinoButton(
              padding: const EdgeInsets.only(left: 8),
              minimumSize: Size.zero,
              onPressed: onDelete,
              child: Icon(CupertinoIcons.delete, size: 17, color: CupertinoColors.systemGrey.resolveFrom(context)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyText(String text) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        child: Text(text, style: TextStyle(fontSize: 14, color: AppCupertinoTheme.tertiary(context))),
      );

  @override
  Widget build(BuildContext context) {
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
          padding: const EdgeInsets.only(top: 4, bottom: 44),
          children: [
            formSectionLabel(context, 'Overview'),
            formCard(context, children: [
              formTapRow(context,
                  label: 'Date',
                  value: _date ?? 'Not set',
                  muted: _date == null,
                  onTap: _pickDate),
              formInlineField(context,
                  label: 'Title', field: formInput(context, _titleController, placeholder: 'Day title')),
              formInlineField(context,
                  label: 'Place', field: formInput(context, _placeController, placeholder: 'Primary location')),
              formInlineField(context,
                  label: 'Weather', field: formInput(context, _weatherController, placeholder: 'e.g. Sunny')),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    Text('Mood', style: TextStyle(fontSize: 15, color: AppCupertinoTheme.label(context))),
                    const Spacer(),
                    ...List.generate(5, (i) {
                      final value = i + 1;
                      final selected = _mood == value;
                      return GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() => _mood = selected ? null : value);
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 140),
                          margin: const EdgeInsets.only(left: 7),
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: selected ? AppCupertinoTheme.brandAccent : AppCupertinoTheme.subtleFill.resolveFrom(context),
                            boxShadow: selected
                                ? [BoxShadow(color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.3), blurRadius: 8, offset: const Offset(0, 2))]
                                : null,
                          ),
                          child: Text('$value',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: selected ? CupertinoColors.white : AppCupertinoTheme.label(context))),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ]),

            // Transport
            formSectionLabel(context, 'Transport', trailing: _addButton(() async {
              final leg = await editTransportLeg(context, TransportLeg(id: genId('leg')));
              if (leg != null) setState(() => _transport.add(leg));
            })),
            formCard(context, children: _transport.isEmpty
                ? [_emptyText('No transport legs')]
                : [
                    for (final leg in _transport)
                      _premiumEntryRow(
                        icon: _modeIcons[leg.mode] ?? CupertinoIcons.arrow_right,
                        title: leg.routeLabel.isNotEmpty ? leg.routeLabel : leg.mode,
                        subtitle: leg.mode[0].toUpperCase() + leg.mode.substring(1),
                        cost: formatCostTotals(leg.cost != null ? {(leg.currency ?? '').trim(): leg.cost!} : {}),
                        onEdit: () async {
                          final updated = await editTransportLeg(context, leg);
                          if (updated != null) {
                            setState(() {
                              final i = _transport.indexWhere((l) => l.id == leg.id);
                              if (i != -1) _transport[i] = updated;
                            });
                          }
                        },
                        onDelete: () => setState(() => _transport.removeWhere((l) => l.id == leg.id)),
                      ),
                  ]),

            // Food
            formSectionLabel(context, 'Food', trailing: _addButton(() async {
              final meal = await editMeal(context, MealEntry(id: genId('meal')));
              if (meal != null) setState(() => _meals.add(meal));
            })),
            formCard(context, children: _meals.isEmpty
                ? [_emptyText('No meals')]
                : [
                    for (final meal in _meals)
                      _premiumEntryRow(
                        icon: CupertinoIcons.square_favorites_alt,
                        title: meal.place != null && meal.place!.isNotEmpty
                            ? meal.place!
                            : (meal.type[0].toUpperCase() + meal.type.substring(1)),
                        subtitle: [
                          meal.type[0].toUpperCase() + meal.type.substring(1),
                          if (meal.dishes != null && meal.dishes!.isNotEmpty) meal.dishes!,
                        ].join(' · '),
                        cost: formatCostTotals(meal.cost != null ? {(meal.currency ?? '').trim(): meal.cost!} : {}),
                        onEdit: () async {
                          final updated = await editMeal(context, meal);
                          if (updated != null) {
                            setState(() {
                              final i = _meals.indexWhere((m) => m.id == meal.id);
                              if (i != -1) _meals[i] = updated;
                            });
                          }
                        },
                        onDelete: () => setState(() => _meals.removeWhere((m) => m.id == meal.id)),
                      ),
                  ]),

            // Activities
            formSectionLabel(context, 'Activities', trailing: _addButton(() async {
              final act = await editActivity(context, ActivityEntry(id: genId('act')));
              if (act != null && act.title.isNotEmpty) setState(() => _activities.add(act));
            })),
            formCard(context, children: _activities.isEmpty
                ? [_emptyText('No activities')]
                : [
                    for (final act in _activities)
                      _premiumEntryRow(
                        icon: CupertinoIcons.star,
                        title: act.title.isNotEmpty ? act.title : 'Activity',
                        subtitle: [
                          if (act.time != null && act.time!.isNotEmpty) act.time!,
                          if (act.locationName != null && act.locationName!.isNotEmpty) act.locationName!,
                        ].join(' · '),
                        cost: formatCostTotals(act.cost != null ? {(act.currency ?? '').trim(): act.cost!} : {}),
                        onEdit: () async {
                          final updated = await editActivity(context, act);
                          if (updated != null) {
                            setState(() {
                              final i = _activities.indexWhere((a) => a.id == act.id);
                              if (i != -1) _activities[i] = updated;
                            });
                          }
                        },
                        onDelete: () => setState(() => _activities.removeWhere((a) => a.id == act.id)),
                      ),
                  ]),

            // Stay
            formSectionLabel(context, 'Stay'),
            formCard(context, children: [
              formInlineField(context, label: 'Hotel', field: formInput(context, _stayNameController, placeholder: 'Accommodation name')),
              formInlineField(context,
                  label: 'Cost',
                  field: formInput(context, _stayCostController, placeholder: '0', keyboardType: const TextInputType.numberWithOptions(decimal: true))),
              formInlineField(context, label: 'Currency', field: formInput(context, _stayCurrencyController, placeholder: '₹ / \$ / €')),
            ]),

            // Notes
            formSectionLabel(context, 'Notes'),
            formCard(context, children: [
              formTextArea(context, _notesController, placeholder: 'Markdown notes for the day...', minLines: 3, maxLines: 6),
            ]),

            // Photos
            formSectionLabel(context, 'Photos', trailing: _addButton(_addPhotos)),
            formCard(context, children: [
              if (_photos.isEmpty)
                _emptyText('No photos')
              else
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _photos.map((p) {
                      return Stack(
                        clipBehavior: Clip.none,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: CachedNetworkImage(
                              cacheManager: PeopleImageCacheManager.instance,
                              imageUrl: p.url,
                              width: 78,
                              height: 78,
                              fit: BoxFit.cover,
                              errorWidget: (_, _, _) => Container(
                                width: 78,
                                height: 78,
                                color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                                child: const Icon(CupertinoIcons.photo, color: CupertinoColors.systemGrey),
                              ),
                            ),
                          ),
                          Positioned(
                            top: -7,
                            right: -7,
                            child: GestureDetector(
                              onTap: () => setState(() => _photos.remove(p)),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: CupertinoColors.systemRed,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: AppCupertinoTheme.cardBackground.resolveFrom(context), width: 2),
                                ),
                                padding: const EdgeInsets.all(2),
                                child: const Icon(CupertinoIcons.xmark, size: 12, color: CupertinoColors.white),
                              ),
                            ),
                          ),
                        ],
                      );
                    }).toList(),
                  ),
                ),
            ]),
          ],
        ),
      ),
    );
  }
}
