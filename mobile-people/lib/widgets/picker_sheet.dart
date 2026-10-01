import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/theme/cupertino_theme.dart';

/// A single selectable option for [OptionChipGrid].
class OptionChipData {
  final String value;
  final String label;
  final IconData? icon;
  const OptionChipData(this.value, this.label, {this.icon});
}

/// A premium wrap of tappable pills used in place of inline picker wheels for
/// small enumerations (travel mode, meal type, trip status, …).
class OptionChipGrid extends StatelessWidget {
  final List<OptionChipData> options;
  final String? selected;
  final ValueChanged<String> onSelect;

  const OptionChipGrid({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final labelColor = AppCupertinoTheme.label(context);
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: options.map((o) {
        final isSel = o.value == selected;
        return GestureDetector(
          onTap: () {
            HapticFeedback.selectionClick();
            onSelect(o.value);
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 140),
            curve: Curves.easeOut,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: isSel
                  ? AppCupertinoTheme.brandAccent
                  : AppCupertinoTheme.subtleFill.resolveFrom(context),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSel
                    ? AppCupertinoTheme.brandAccent
                    : AppCupertinoTheme.cardBorder.resolveFrom(context),
                width: 1,
              ),
              boxShadow: isSel
                  ? [
                      BoxShadow(
                        color: AppCupertinoTheme.brandAccent.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (o.icon != null) ...[
                  Icon(o.icon, size: 15, color: isSel ? CupertinoColors.white : labelColor),
                  const SizedBox(width: 6),
                ],
                Text(
                  o.label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                    color: isSel ? CupertinoColors.white : labelColor,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

/// Premium bottom-sheet chrome for a wheel picker (grabber, header, card).
/// Used for date selection so it reads as a polished sheet rather than a bare
/// grey wheel on a flat background.
Future<void> showPremiumDateSheet(
  BuildContext context, {
  required String title,
  required DateTime initial,
  required ValueChanged<DateTime> onChanged,
  DateTime? minimum,
  DateTime? maximum,
  VoidCallback? onClear,
}) {
  return showCupertinoModalPopup<void>(
    context: context,
    builder: (ctx) {
      final labelColor = AppCupertinoTheme.label(ctx);
      return Container(
        margin: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: AppCupertinoTheme.cardBackground.resolveFrom(ctx),
          borderRadius: BorderRadius.circular(22),
          boxShadow: [
            BoxShadow(
              color: CupertinoColors.black.withValues(alpha: 0.18),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(
                width: 36,
                height: 5,
                decoration: BoxDecoration(
                  color: CupertinoColors.systemGrey3.resolveFrom(ctx),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
                child: Row(
                  children: [
                    SizedBox(
                      width: 70,
                      child: onClear != null
                          ? CupertinoButton(
                              padding: EdgeInsets.zero,
                              alignment: Alignment.centerLeft,
                              onPressed: () {
                                onClear();
                                Navigator.pop(ctx);
                              },
                              child: const Text('Clear',
                                  style: TextStyle(color: CupertinoColors.systemRed, fontSize: 15)),
                            )
                          : null,
                    ),
                    Expanded(
                      child: Text(
                        title,
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: labelColor),
                      ),
                    ),
                    SizedBox(
                      width: 70,
                      child: CupertinoButton(
                        padding: EdgeInsets.zero,
                        alignment: Alignment.centerRight,
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Done',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                height: 0.5,
                color: AppCupertinoTheme.cardBorder.resolveFrom(ctx),
              ),
              SizedBox(
                height: 216,
                child: CupertinoDatePicker(
                  mode: CupertinoDatePickerMode.date,
                  initialDateTime: initial,
                  minimumDate: minimum ?? DateTime(1990),
                  maximumDate: maximum ?? DateTime(2100),
                  onDateTimeChanged: onChanged,
                ),
              ),
              const SizedBox(height: 6),
            ],
          ),
        ),
      );
    },
  );
}
