import 'package:flutter/cupertino.dart';
import '../core/models/trip_day.dart';
import '../widgets/picker_sheet.dart';

const Map<String, IconData> _modeIcons = {
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

const Map<String, IconData> _mealIcons = {
  'breakfast': CupertinoIcons.sunrise,
  'lunch': CupertinoIcons.sun_max,
  'dinner': CupertinoIcons.moon_stars,
  'snack': CupertinoIcons.square_favorites_alt,
  'drinks': CupertinoIcons.drop,
};

/// Lightweight sub-editors for itinerary day entries (transport / meals /
/// activities), each returning the edited entry via Navigator.pop.

num? _parseCost(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return null;
  return num.tryParse(t);
}

Future<T?> _showEditor<T>(BuildContext context, Widget child) {
  return Navigator.of(context).push<T>(
    CupertinoPageRoute(fullscreenDialog: true, builder: (_) => child),
  );
}

Widget _editorScaffold({
  required BuildContext context,
  required String title,
  required VoidCallback onSave,
  required List<Widget> children,
}) {
  return CupertinoPageScaffold(
    backgroundColor: CupertinoColors.systemGroupedBackground,
    navigationBar: CupertinoNavigationBar(
      middle: Text(title),
      leading: CupertinoButton(
        padding: EdgeInsets.zero,
        onPressed: () => Navigator.of(context).pop(),
        child: const Text('Cancel'),
      ),
      trailing: CupertinoButton(
        padding: EdgeInsets.zero,
        onPressed: onSave,
        child: const Text('Done', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    ),
    child: SafeArea(child: ListView(padding: const EdgeInsets.only(bottom: 40), children: children)),
  );
}

// ---------------------------------------------------------------------------
// Transport leg editor
// ---------------------------------------------------------------------------

Future<TransportLeg?> editTransportLeg(BuildContext context, TransportLeg leg) {
  return _showEditor<TransportLeg>(context, _LegEditor(leg: leg));
}

class _LegEditor extends StatefulWidget {
  final TransportLeg leg;
  const _LegEditor({required this.leg});

  @override
  State<_LegEditor> createState() => _LegEditorState();
}

class _LegEditorState extends State<_LegEditor> {
  late final TextEditingController _from;
  late final TextEditingController _to;
  late final TextEditingController _cost;
  late final TextEditingController _currency;
  late final TextEditingController _notes;
  late String _mode;

  static const modes = ['walk', 'bike', 'bus', 'train', 'flight', 'car', 'taxi', 'boat', 'other'];

  @override
  void initState() {
    super.initState();
    _from = TextEditingController(text: widget.leg.fromName ?? '');
    _to = TextEditingController(text: widget.leg.toName ?? '');
    _cost = TextEditingController(text: widget.leg.cost?.toString() ?? '');
    _currency = TextEditingController(text: widget.leg.currency ?? '');
    _notes = TextEditingController(text: widget.leg.notes ?? '');
    _mode = widget.leg.mode;
  }

  @override
  void dispose() {
    _from.dispose();
    _to.dispose();
    _cost.dispose();
    _currency.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _save() {
    Navigator.of(context).pop(TransportLeg(
      id: widget.leg.id,
      mode: _mode,
      fromName: _from.text.trim().isEmpty ? null : _from.text.trim(),
      toName: _to.text.trim().isEmpty ? null : _to.text.trim(),
      waypoints: widget.leg.waypoints,
      departTime: widget.leg.departTime,
      arriveTime: widget.leg.arriveTime,
      cost: _parseCost(_cost.text),
      currency: _currency.text.trim().isEmpty ? null : _currency.text.trim(),
      notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return _editorScaffold(
      context: context,
      title: 'Transport',
      onSave: _save,
      children: [
        CupertinoListSection.insetGrouped(
          header: const Text('MODE'),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: OptionChipGrid(
                selected: _mode,
                onSelect: (v) => setState(() => _mode = v),
                options: modes
                    .map((m) => OptionChipData(m, m[0].toUpperCase() + m.substring(1), icon: _modeIcons[m]))
                    .toList(),
              ),
            ),
          ],
        ),
        CupertinoListSection.insetGrouped(
          children: [
            CupertinoTextFormFieldRow(controller: _from, prefix: const Text('From'), placeholder: 'Origin'),
            CupertinoTextFormFieldRow(controller: _to, prefix: const Text('To'), placeholder: 'Destination'),
            CupertinoTextFormFieldRow(controller: _cost, prefix: const Text('Cost'), placeholder: '0', keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            CupertinoTextFormFieldRow(controller: _currency, prefix: const Text('Currency'), placeholder: '₹ / \$ / €'),
            CupertinoTextFormFieldRow(controller: _notes, prefix: const Text('Notes'), placeholder: 'Optional'),
          ],
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Meal editor
// ---------------------------------------------------------------------------

Future<MealEntry?> editMeal(BuildContext context, MealEntry meal) {
  return _showEditor<MealEntry>(context, _MealEditor(meal: meal));
}

class _MealEditor extends StatefulWidget {
  final MealEntry meal;
  const _MealEditor({required this.meal});

  @override
  State<_MealEditor> createState() => _MealEditorState();
}

class _MealEditorState extends State<_MealEditor> {
  late final TextEditingController _place;
  late final TextEditingController _dishes;
  late final TextEditingController _cost;
  late final TextEditingController _currency;
  late String _type;

  static const types = ['breakfast', 'lunch', 'dinner', 'snack', 'drinks'];

  @override
  void initState() {
    super.initState();
    _place = TextEditingController(text: widget.meal.place ?? '');
    _dishes = TextEditingController(text: widget.meal.dishes ?? '');
    _cost = TextEditingController(text: widget.meal.cost?.toString() ?? '');
    _currency = TextEditingController(text: widget.meal.currency ?? '');
    _type = widget.meal.type;
  }

  @override
  void dispose() {
    _place.dispose();
    _dishes.dispose();
    _cost.dispose();
    _currency.dispose();
    super.dispose();
  }

  void _save() {
    Navigator.of(context).pop(MealEntry(
      id: widget.meal.id,
      type: _type,
      place: _place.text.trim().isEmpty ? null : _place.text.trim(),
      dishes: _dishes.text.trim().isEmpty ? null : _dishes.text.trim(),
      cost: _parseCost(_cost.text),
      currency: _currency.text.trim().isEmpty ? null : _currency.text.trim(),
      rating: widget.meal.rating,
      notes: widget.meal.notes,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return _editorScaffold(
      context: context,
      title: 'Meal',
      onSave: _save,
      children: [
        CupertinoListSection.insetGrouped(
          header: const Text('TYPE'),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: OptionChipGrid(
                selected: _type,
                onSelect: (v) => setState(() => _type = v),
                options: types
                    .map((t) => OptionChipData(t, t[0].toUpperCase() + t.substring(1), icon: _mealIcons[t]))
                    .toList(),
              ),
            ),
          ],
        ),
        CupertinoListSection.insetGrouped(
          children: [
            CupertinoTextFormFieldRow(controller: _place, prefix: const Text('Place'), placeholder: 'Restaurant / spot'),
            CupertinoTextFormFieldRow(controller: _dishes, prefix: const Text('Dishes'), placeholder: 'What you ate'),
            CupertinoTextFormFieldRow(controller: _cost, prefix: const Text('Cost'), placeholder: '0', keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            CupertinoTextFormFieldRow(controller: _currency, prefix: const Text('Currency'), placeholder: '₹ / \$ / €'),
          ],
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Activity editor
// ---------------------------------------------------------------------------

Future<ActivityEntry?> editActivity(BuildContext context, ActivityEntry act) {
  return _showEditor<ActivityEntry>(context, _ActivityEditor(act: act));
}

class _ActivityEditor extends StatefulWidget {
  final ActivityEntry act;
  const _ActivityEditor({required this.act});

  @override
  State<_ActivityEditor> createState() => _ActivityEditorState();
}

class _ActivityEditorState extends State<_ActivityEditor> {
  late final TextEditingController _title;
  late final TextEditingController _time;
  late final TextEditingController _location;
  late final TextEditingController _cost;
  late final TextEditingController _currency;

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(text: widget.act.title);
    _time = TextEditingController(text: widget.act.time ?? '');
    _location = TextEditingController(text: widget.act.locationName ?? '');
    _cost = TextEditingController(text: widget.act.cost?.toString() ?? '');
    _currency = TextEditingController(text: widget.act.currency ?? '');
  }

  @override
  void dispose() {
    _title.dispose();
    _time.dispose();
    _location.dispose();
    _cost.dispose();
    _currency.dispose();
    super.dispose();
  }

  void _save() {
    Navigator.of(context).pop(ActivityEntry(
      id: widget.act.id,
      title: _title.text.trim(),
      time: _time.text.trim().isEmpty ? null : _time.text.trim(),
      locationName: _location.text.trim().isEmpty ? null : _location.text.trim(),
      cost: _parseCost(_cost.text),
      currency: _currency.text.trim().isEmpty ? null : _currency.text.trim(),
      notes: widget.act.notes,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return _editorScaffold(
      context: context,
      title: 'Activity',
      onSave: _save,
      children: [
        CupertinoListSection.insetGrouped(
          children: [
            CupertinoTextFormFieldRow(controller: _title, prefix: const Text('Title'), placeholder: 'What you did'),
            CupertinoTextFormFieldRow(controller: _time, prefix: const Text('Time'), placeholder: 'e.g. 2:00 PM'),
            CupertinoTextFormFieldRow(controller: _location, prefix: const Text('Place'), placeholder: 'Where'),
            CupertinoTextFormFieldRow(controller: _cost, prefix: const Text('Cost'), placeholder: '0', keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            CupertinoTextFormFieldRow(controller: _currency, prefix: const Text('Currency'), placeholder: '₹ / \$ / €'),
          ],
        ),
      ],
    );
  }
}
