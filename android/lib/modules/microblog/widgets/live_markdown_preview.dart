import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

class LiveMarkdownPreview extends StatelessWidget {
  final String markdownContent;

  const LiveMarkdownPreview({super.key, required this.markdownContent});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    if (markdownContent.trim().isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        alignment: Alignment.center,
        child: Text(
          'Live markdown preview will appear here as you type...',
          style: TextStyle(
            color: colorScheme.onSurface.withOpacity(0.4),
            fontStyle: FontStyle.italic,
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      child: MarkdownBody(
        data: markdownContent,
        selectable: true,
        styleSheet: MarkdownStyleSheet.fromTheme(theme).copyWith(
          p: TextStyle(fontSize: 14, color: colorScheme.onSurface, height: 1.5),
          h1: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: colorScheme.onSurface),
          h2: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: colorScheme.onSurface),
          h3: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colorScheme.onSurface),
          code: TextStyle(
            fontSize: 13,
            fontFamily: 'monospace',
            backgroundColor: colorScheme.onSurface.withOpacity(0.08),
            color: colorScheme.primary,
          ),
          codeblockDecoration: BoxDecoration(
            color: colorScheme.surface,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: colorScheme.outline.withOpacity(0.2)),
          ),
          blockquoteDecoration: BoxDecoration(
            color: colorScheme.primary.withOpacity(0.05),
            borderRadius: const BorderRadius.only(
              topRight: Radius.circular(4),
              bottomRight: Radius.circular(4),
            ),
            border: Border(
              left: BorderSide(color: colorScheme.primary, width: 3),
            ),
          ),
        ),
      ),
    );
  }
}
