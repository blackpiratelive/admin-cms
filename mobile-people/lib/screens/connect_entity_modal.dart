import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/models/person_record.dart';
import '../core/models/picker_items.dart';
import '../core/network/api_service.dart';
import '../core/network/sync_service.dart';
import '../core/theme/cupertino_theme.dart';
import 'photo_picker_modal.dart';

class ConnectEntityModal extends StatefulWidget {
  final PersonRecord person;
  final VoidCallback onSuccess;

  const ConnectEntityModal({
    super.key,
    required this.person,
    required this.onSuccess,
  });

  static Future<void> show(BuildContext context, {required PersonRecord person, required VoidCallback onSuccess}) {
    return showCupertinoModalPopup<void>(
      context: context,
      builder: (_) => ConnectEntityModal(person: person, onSuccess: onSuccess),
    );
  }

  @override
  State<ConnectEntityModal> createState() => _ConnectEntityModalState();
}

class _ConnectEntityModalState extends State<ConnectEntityModal> {
  String _targetType = 'location';
  String? _selectedTargetId;
  final TextEditingController _verbController = TextEditingController(text: 'visited');

  bool _loadingPickers = true;
  bool _isSubmitting = false;
  String? _errorMessage;
  PeoplePickersResult _pickers = const PeoplePickersResult();

  @override
  void initState() {
    super.initState();
    _loadPickers();
  }

  Future<void> _loadPickers() async {
    setState(() => _loadingPickers = true);
    try {
      final res = await ApiService.getPickers();
      if (mounted) {
        setState(() {
          _pickers = res;
          _loadingPickers = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingPickers = false);
    }
  }

  @override
  void dispose() {
    _verbController.dispose();
    super.dispose();
  }

  void _onTypeChanged(String newType) {
    if (newType == 'gallery') {
      Navigator.of(context).pop();
      PhotoPickerModal.show(context, person: widget.person, onSuccess: widget.onSuccess);
      return;
    }

    setState(() {
      _targetType = newType;
      _selectedTargetId = null;
      switch (newType) {
        case 'location':
          _verbController.text = 'visited';
          break;
        case 'trip':
          _verbController.text = 'joined';
          break;
        case 'gallery':
          _verbController.text = 'appears_in';
          break;
        case 'microblog':
          _verbController.text = 'mentions';
          break;
        case 'project':
          _verbController.text = 'worked_on';
          break;
        case 'collection':
          _verbController.text = 'member';
          break;
      }
    });
  }

  Future<void> _handleSubmit() async {
    if (_selectedTargetId == null || _selectedTargetId!.isEmpty) {
      setState(() => _errorMessage = 'Please select an entity to connect.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    HapticFeedback.lightImpact();

    final verb = _verbController.text.trim();
    try {
      final ok = await ApiService.addConnection(
        personId: widget.person.id,
        targetType: _targetType,
        targetId: _selectedTargetId!,
        relationship: verb.isNotEmpty ? verb : 'connected_to',
      );
      if (ok && mounted) {
        widget.onSuccess();
        Navigator.of(context).pop();
      } else {
        throw Exception('Failed to connect');
      }
    } catch (e) {
      // Offline fallback: enqueue mutation
      await SyncService.queueMutation(
        type: 'add_connection',
        entityId: widget.person.id,
        payload: {
          'targetType': _targetType,
          'targetId': _selectedTargetId!,
          'relationship': verb.isNotEmpty ? verb : 'connected_to',
        },
      );
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
    final availableItems = _pickers.getByType(_targetType);

    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppCupertinoTheme.cardBackground.resolveFrom(context),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: AppCupertinoTheme.cardBorder.resolveFrom(context),
            width: 0.8,
          ),
          boxShadow: [
            BoxShadow(
              color: CupertinoColors.systemGrey5.resolveFrom(context).withValues(alpha: 0.3),
              offset: const Offset(0, 2),
              blurRadius: 8,
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(CupertinoIcons.link, color: Color(0xFF8B5CF6), size: 18),
                    const SizedBox(width: 8),
                    Text(
                      'Connect to ${widget.person.displayName}',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.3,
                        color: AppCupertinoTheme.label(context),
                      ),
                    ),
                  ],
                ),
                CupertinoButton(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Icon(CupertinoIcons.clear_circled_solid, color: CupertinoColors.systemGrey, size: 22),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Segmented Entity Type Selector
            CupertinoSlidingSegmentedControl<String>(
              groupValue: _targetType,
              onValueChanged: (val) {
                if (val != null) _onTypeChanged(val);
              },
              children: const {
                'location': Text('Place', style: TextStyle(fontSize: 12)),
                'trip': Text('Trip', style: TextStyle(fontSize: 12)),
                'gallery': Text('Photo', style: TextStyle(fontSize: 12)),
                'microblog': Text('Post', style: TextStyle(fontSize: 12)),
                'project': Text('Project', style: TextStyle(fontSize: 12)),
                'collection': Text('Group', style: TextStyle(fontSize: 12)),
              },
            ),
            const SizedBox(height: 16),

            // Item Selector List
            Text(
              'SELECT ITEM',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppCupertinoTheme.secondary(context)),
            ),
            const SizedBox(height: 6),

            if (_loadingPickers)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: CupertinoActivityIndicator()),
              )
            else if (availableItems.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  'No ${_targetType}s found.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2, fontSize: 13),
                ),
              )
            else
              Container(
                height: 160,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: isDark ? const Color(0x25FFFFFF) : const Color(0x12000000),
                  border: Border.all(
                    color: isDark ? const Color(0x20FFFFFF) : const Color(0x15000000),
                  ),
                ),
                child: ListView.separated(
                  itemCount: availableItems.length,
                  separatorBuilder: (_, _) => Container(
                    height: 0.5,
                    color: isDark ? const Color(0x15FFFFFF) : const Color(0x10000000),
                  ),
                  itemBuilder: (context, index) {
                    final item = availableItems[index];
                    final isSelected = item.id == _selectedTargetId;
                    return GestureDetector(
                      onTap: () {
                        setState(() => _selectedTargetId = item.id);
                        HapticFeedback.selectionClick();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        color: isSelected
                            ? const Color(0xFF8B5CF6).withValues(alpha: 0.2)
                            : CupertinoColors.transparent,
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.title,
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                      color: AppCupertinoTheme.label(context),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (item.subtitle != null) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      item.subtitle!,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: isDark ? CupertinoColors.systemGrey : CupertinoColors.systemGrey2,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            if (isSelected)
                              const Icon(CupertinoIcons.checkmark_alt, color: Color(0xFF8B5CF6), size: 18),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),

            const SizedBox(height: 14),

            // Relationship Verb Field
            if (_targetType != 'collection') ...[
              Text(
                'RELATIONSHIP VERB / LABEL',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppCupertinoTheme.secondary(context)),
              ),
              const SizedBox(height: 6),
              CupertinoTextField(
                controller: _verbController,
                placeholder: 'e.g. visited, joined, worked_on, appears_in...',
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: isDark ? const Color(0x25FFFFFF) : const Color(0x12000000),
                  border: Border.all(
                    color: isDark ? const Color(0x20FFFFFF) : const Color(0x15000000),
                  ),
                ),
              ),
              const SizedBox(height: 14),
            ],

            if (_errorMessage != null) ...[
              Text(
                _errorMessage!,
                style: const TextStyle(color: CupertinoColors.systemRed, fontSize: 12),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
            ],

            // Submit Button
            CupertinoButton.filled(
              onPressed: _isSubmitting ? null : _handleSubmit,
              borderRadius: BorderRadius.circular(12),
              child: _isSubmitting
                  ? const CupertinoActivityIndicator(color: CupertinoColors.white)
                  : const Text('Add Connection', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }
}
