import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/theme/cupertino_theme.dart';

class PickerOption<T> {
  final String id;
  final String title;
  final String? subtitle;
  final T rawItem;

  const PickerOption({
    required this.id,
    required this.title,
    this.subtitle,
    required this.rawItem,
  });
}

class AssociationPickerSheet<T> extends StatefulWidget {
  final String title;
  final String searchPlaceholder;
  final String? selectedId;
  final List<PickerOption<T>> options;
  final ValueChanged<PickerOption<T>?> onSelected;

  const AssociationPickerSheet({
    super.key,
    required this.title,
    this.searchPlaceholder = 'Search...',
    this.selectedId,
    required this.options,
    required this.onSelected,
  });

  static Future<void> show<T>({
    required BuildContext context,
    required String title,
    String searchPlaceholder = 'Search...',
    String? selectedId,
    required List<PickerOption<T>> options,
    required ValueChanged<PickerOption<T>?> onSelected,
  }) async {
    HapticFeedback.lightImpact();
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => AssociationPickerSheet<T>(
        title: title,
        searchPlaceholder: searchPlaceholder,
        selectedId: selectedId,
        options: options,
        onSelected: onSelected,
      ),
    );
  }

  @override
  State<AssociationPickerSheet<T>> createState() => _AssociationPickerSheetState<T>();
}

class _AssociationPickerSheetState<T> extends State<AssociationPickerSheet<T>> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() => _query = _searchController.text.trim().toLowerCase());
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = widget.options.where((opt) {
      if (_query.isEmpty) return true;
      final matchTitle = opt.title.toLowerCase().contains(_query);
      final matchSub = opt.subtitle?.toLowerCase().contains(_query) ?? false;
      return matchTitle || matchSub;
    }).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: BoxDecoration(
        color: AppCupertinoTheme.cardBackground.resolveFrom(context),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            // Handle Bar
            const SizedBox(height: 8),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: CupertinoColors.systemGrey4.resolveFrom(context),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 4),

            // Top Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Text(
                    widget.title,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: CupertinoColors.label.resolveFrom(context),
                    ),
                  ),
                  const Spacer(),
                  CupertinoButton(
                    padding: EdgeInsets.zero,
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),

            // Search Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: CupertinoSearchTextField(
                controller: _searchController,
                placeholder: widget.searchPlaceholder,
              ),
            ),

            const SizedBox(height: 8),

            // Options List
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  // None Option
                  _buildOptionRow(
                    context: context,
                    isSelected: widget.selectedId == null || widget.selectedId!.isEmpty,
                    title: 'None',
                    subtitle: 'Remove association',
                    icon: CupertinoIcons.clear_circled,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      widget.onSelected(null);
                      Navigator.of(context).pop();
                    },
                  ),
                  const SizedBox(height: 6),

                  // Filtered Options
                  if (filtered.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(32),
                      child: Center(
                        child: Text(
                          _query.isEmpty ? 'No items available' : 'No matches found',
                          style: TextStyle(
                            color: CupertinoColors.secondaryLabel.resolveFrom(context),
                            fontSize: 14,
                          ),
                        ),
                      ),
                    )
                  else
                    ...filtered.map((opt) {
                      final isSelected = opt.id == widget.selectedId;
                      return _buildOptionRow(
                        context: context,
                        isSelected: isSelected,
                        title: opt.title,
                        subtitle: opt.subtitle,
                        onTap: () {
                          HapticFeedback.selectionClick();
                          widget.onSelected(opt);
                          Navigator.of(context).pop();
                        },
                      );
                    }),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOptionRow({
    required BuildContext context,
    required bool isSelected,
    required String title,
    String? subtitle,
    IconData? icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? AppCupertinoTheme.subtleFill.resolveFrom(context)
              : CupertinoColors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected
                ? CupertinoColors.activeBlue.withValues(alpha: 0.3)
                : AppCupertinoTheme.cardBorder.resolveFrom(context).withValues(alpha: 0.4),
            width: isSelected ? 1.5 : 0.8,
          ),
        ),
        child: Row(
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 20,
                color: isSelected
                    ? CupertinoColors.activeBlue
                    : CupertinoColors.secondaryLabel.resolveFrom(context),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                      color: isSelected
                          ? CupertinoColors.activeBlue
                          : CupertinoColors.label.resolveFrom(context),
                    ),
                  ),
                  if (subtitle != null && subtitle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: CupertinoColors.secondaryLabel.resolveFrom(context),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (isSelected)
              const Icon(
                CupertinoIcons.checkmark_alt,
                color: CupertinoColors.activeBlue,
                size: 20,
              ),
          ],
        ),
      ),
    );
  }
}
