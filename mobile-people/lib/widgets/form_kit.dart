import 'package:flutter/cupertino.dart';
import '../core/theme/cupertino_theme.dart';

/// A small, consistent "form kit" that gives the trip forms a premium,
/// production-grade look instead of the stock CupertinoListSection chrome:
/// refined uppercase section labels, soft rounded cards with hairline
/// dividers, inline label+field rows, and clean inputs.

Widget formSectionLabel(BuildContext context, String text, {Widget? trailing}) {
  return Padding(
    padding: const EdgeInsets.fromLTRB(24, 22, 20, 9),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          text.toUpperCase(),
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
            color: AppCupertinoTheme.secondary(context),
          ),
        ),
        ?trailing,
      ],
    ),
  );
}

/// A rounded card that lays out [children] vertically with hairline dividers
/// (inset to [dividerInset]) between them.
Widget formCard(
  BuildContext context, {
  required List<Widget> children,
  double dividerInset = 16,
  EdgeInsets margin = const EdgeInsets.symmetric(horizontal: 16),
}) {
  final divided = <Widget>[];
  for (var i = 0; i < children.length; i++) {
    divided.add(children[i]);
    if (i != children.length - 1) {
      divided.add(Padding(
        padding: EdgeInsets.only(left: dividerInset),
        child: Container(height: 0.5, color: AppCupertinoTheme.cardBorder.resolveFrom(context)),
      ));
    }
  }

  return Container(
    margin: margin,
    decoration: BoxDecoration(
      color: AppCupertinoTheme.cardBackground.resolveFrom(context),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppCupertinoTheme.cardBorder.resolveFrom(context), width: 0.5),
      boxShadow: [
        BoxShadow(
          color: CupertinoColors.systemGrey5.resolveFrom(context).withValues(alpha: 0.22),
          blurRadius: 10,
          offset: const Offset(0, 3),
        ),
      ],
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: divided),
  );
}

/// Inline "Label        field" row used for single-line text inputs.
Widget formInlineField(BuildContext context, {required String label, required Widget field, double labelWidth = 96}) {
  return Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    child: Row(
      children: [
        SizedBox(
          width: labelWidth,
          child: Text(label, style: TextStyle(fontSize: 15, color: AppCupertinoTheme.label(context))),
        ),
        Expanded(child: field),
      ],
    ),
  );
}

/// A clean inline text field (transparent — the card provides the surface).
Widget formInput(
  BuildContext context,
  TextEditingController controller, {
  String? placeholder,
  TextInputType? keyboardType,
  TextAlign textAlign = TextAlign.start,
  ValueChanged<String>? onChanged,
}) {
  return CupertinoTextField(
    controller: controller,
    placeholder: placeholder,
    keyboardType: keyboardType,
    textAlign: textAlign,
    onChanged: onChanged,
    padding: const EdgeInsets.symmetric(vertical: 11),
    decoration: const BoxDecoration(),
    style: TextStyle(fontSize: 15, color: AppCupertinoTheme.label(context)),
    placeholderStyle: TextStyle(fontSize: 15, color: AppCupertinoTheme.tertiary(context)),
    cursorColor: AppCupertinoTheme.brandAccent,
  );
}

/// A tappable value row ("Start date        Not set  ›").
Widget formTapRow(
  BuildContext context, {
  required String label,
  required String value,
  required VoidCallback onTap,
  bool muted = false,
  IconData trailingIcon = CupertinoIcons.chevron_right,
}) {
  return GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Text(label, style: TextStyle(fontSize: 15, color: AppCupertinoTheme.label(context))),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 15,
                color: muted ? AppCupertinoTheme.tertiary(context) : AppCupertinoTheme.secondary(context),
              ),
            ),
          ),
          const SizedBox(width: 6),
          Icon(trailingIcon, size: 16, color: AppCupertinoTheme.tertiary(context)),
        ],
      ),
    ),
  );
}

/// A full-width multi-line text area inside a card.
Widget formTextArea(
  BuildContext context,
  TextEditingController controller, {
  String? placeholder,
  int minLines = 3,
  int maxLines = 6,
}) {
  return Padding(
    padding: const EdgeInsets.all(14),
    child: CupertinoTextField(
      controller: controller,
      placeholder: placeholder,
      minLines: minLines,
      maxLines: maxLines,
      padding: const EdgeInsets.all(12),
      style: TextStyle(fontSize: 15, height: 1.35, color: AppCupertinoTheme.label(context)),
      placeholderStyle: TextStyle(fontSize: 15, color: AppCupertinoTheme.tertiary(context)),
      cursorColor: AppCupertinoTheme.brandAccent,
      decoration: BoxDecoration(
        color: AppCupertinoTheme.subtleFill.resolveFrom(context),
        borderRadius: BorderRadius.circular(12),
      ),
    ),
  );
}
