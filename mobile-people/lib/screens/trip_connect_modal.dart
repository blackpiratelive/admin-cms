import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/models/picker_items.dart';
import '../core/network/api_service.dart';
import '../core/theme/cupertino_theme.dart';

/// Pick a location or person to link to a trip (POST /api/trips/[id]/connections).
class TripConnectModal extends StatefulWidget {
  final String tripId;
  final String targetType; // 'location' | 'person'
  final VoidCallback onConnected;

  const TripConnectModal({
    super.key,
    required this.tripId,
    required this.targetType,
    required this.onConnected,
  });

  static Future<void> show(
    BuildContext context, {
    required String tripId,
    required String targetType,
    required VoidCallback onConnected,
  }) {
    return showCupertinoModalPopup<void>(
      context: context,
      builder: (_) => TripConnectModal(
        tripId: tripId,
        targetType: targetType,
        onConnected: onConnected,
      ),
    );
  }

  @override
  State<TripConnectModal> createState() => _TripConnectModalState();
}

class _TripConnectModalState extends State<TripConnectModal> {
  final TextEditingController _searchController = TextEditingController();
  List<({String id, String title, String? subtitle})> _options = [];
  String _query = '';
  bool _loading = true;
  String? _connectingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      if (widget.targetType == 'person') {
        final people = await ApiService.getPeople(limit: 500);
        _options = people.items
            .map((p) => (id: p.id, title: p.displayName, subtitle: p.relationshipType as String?))
            .toList();
      } else {
        final pickers = await ApiService.getPickers();
        _options = pickers.locations
            .map((PickerItem l) => (id: l.id, title: l.title, subtitle: l.subtitle))
            .toList();
      }
    } catch (_) {
      _options = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  List<({String id, String title, String? subtitle})> get _filtered {
    if (_query.trim().isEmpty) return _options;
    final q = _query.trim().toLowerCase();
    return _options.where((o) => o.title.toLowerCase().contains(q)).toList();
  }

  Future<void> _connect(String id) async {
    setState(() => _connectingId = id);
    HapticFeedback.lightImpact();
    try {
      await ApiService.connectTripEntity(widget.tripId, widget.targetType, id);
      if (mounted) {
        widget.onConnected();
        Navigator.of(context).pop();
      }
    } catch (_) {
      if (mounted) setState(() => _connectingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondary = AppCupertinoTheme.secondary(context);
    final isPerson = widget.targetType == 'person';

    return Container(
      height: MediaQuery.of(context).size.height * 0.8,
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: AppCupertinoTheme.cardBackground.resolveFrom(context),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 14, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(isPerson ? 'Link a person' : 'Link a location',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: labelColor)),
                CupertinoButton(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Icon(CupertinoIcons.clear_circled_solid, color: CupertinoColors.systemGrey, size: 24),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: CupertinoSearchTextField(
              controller: _searchController,
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _loading
                ? const Center(child: CupertinoActivityIndicator())
                : _filtered.isEmpty
                    ? Center(child: Text('Nothing to link', style: TextStyle(color: secondary)))
                    : ListView.separated(
                        itemCount: _filtered.length,
                        separatorBuilder: (_, _) => Container(
                          height: 0.5,
                          margin: const EdgeInsets.only(left: 16),
                          color: AppCupertinoTheme.cardBorder.resolveFrom(context),
                        ),
                        itemBuilder: (context, idx) {
                          final o = _filtered[idx];
                          return CupertinoListTile(
                            title: Text(o.title, style: TextStyle(color: labelColor)),
                            subtitle: o.subtitle != null && o.subtitle!.isNotEmpty
                                ? Text(o.subtitle!, style: TextStyle(color: secondary, fontSize: 12.5))
                                : null,
                            trailing: _connectingId == o.id
                                ? const CupertinoActivityIndicator()
                                : const Icon(CupertinoIcons.add_circled, color: AppCupertinoTheme.brandAccent),
                            onTap: _connectingId == null ? () => _connect(o.id) : null,
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
