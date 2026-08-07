import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

class CommandPaletteModal extends StatefulWidget {
  final Function(String moduleKey) onSelectModule;

  const CommandPaletteModal({super.key, required this.onSelectModule});

  @override
  State<CommandPaletteModal> createState() => _CommandPaletteModalState();
}

class _CommandPaletteModalState extends State<CommandPaletteModal> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';

  final List<Map<String, dynamic>> _allCommands = [
    {'key': 'microblog', 'title': 'Microblog Posts', 'category': 'Content', 'icon': LucideIcons.messageSquare},
    {'key': 'dashboard', 'title': 'Dashboard Overview', 'category': 'Overview', 'icon': LucideIcons.layoutDashboard},
    {'key': 'analytics', 'title': 'Analytics & Memory', 'category': 'Overview', 'icon': LucideIcons.barChart2},
    {'key': 'journal', 'title': 'Encrypted Journal', 'category': 'Content', 'icon': LucideIcons.bookOpen},
    {'key': 'blog', 'title': 'Long-form Blog', 'category': 'Content', 'icon': LucideIcons.fileText},
    {'key': 'notes', 'title': 'Quick Notes', 'category': 'Content', 'icon': LucideIcons.stickyNote},
    {'key': 'pages', 'title': 'Static Pages', 'category': 'Content', 'icon': LucideIcons.file},
    {'key': 'todos', 'title': 'Todos & Projects', 'category': 'Tracking', 'icon': LucideIcons.checkSquare},
    {'key': 'books', 'title': 'Reading & Books', 'category': 'Tracking', 'icon': LucideIcons.book},
    {'key': 'games', 'title': 'Gaming Log', 'category': 'Tracking', 'icon': LucideIcons.gamepad2},
    {'key': 'storage', 'title': 'Storage & R2', 'category': 'Media', 'icon': LucideIcons.hardDrive},
    {'key': 'gallery', 'title': 'Photo Gallery', 'category': 'Media', 'icon': LucideIcons.image},
    {'key': 'uploads', 'title': 'Media Uploads', 'category': 'Media', 'icon': LucideIcons.uploadCloud},
    {'key': 'bookmarks', 'title': 'Bookmarks', 'category': 'Collections', 'icon': LucideIcons.bookmark},
    {'key': 'quotes', 'title': 'Quotes', 'category': 'Collections', 'icon': LucideIcons.quote},
    {'key': 'links', 'title': 'RapidLink Short URLs', 'category': 'Collections', 'icon': LucideIcons.link},
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final filtered = _allCommands.where((cmd) {
      final q = _query.toLowerCase().trim();
      if (q.isEmpty) return true;
      return cmd['title'].toString().toLowerCase().contains(q) ||
          cmd['category'].toString().toLowerCase().contains(q);
    }).toList();

    return Dialog(
      alignment: Alignment.topCenter,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 48),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 550),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colorScheme.outline.withValues(alpha: 0.3)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Search Input Header
            TextField(
              controller: _searchController,
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'Type a command or search entities...',
                prefixIcon: const Icon(LucideIcons.search, size: 18),
                suffixIcon: IconButton(
                  icon: const Icon(LucideIcons.x, size: 16),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
              onChanged: (val) => setState(() => _query = val),
            ),
            const SizedBox(height: 12),

            // Command List
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 350),
              child: filtered.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'No matching command found.',
                        style: TextStyle(color: colorScheme.onSurface.withValues(alpha: 0.5)),
                      ),
                    )
                  : ListView.builder(
                      shrinkWrap: true,
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final item = filtered[index];
                        final isMicroblog = item['key'] == 'microblog';

                        return ListTile(
                          dense: true,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                          leading: Icon(item['icon'] as IconData, size: 18, color: colorScheme.primary),
                          title: Text(
                            item['title'],
                            style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                          ),
                          subtitle: Text(
                            item['category'],
                            style: TextStyle(fontSize: 11, color: colorScheme.onSurface.withValues(alpha: 0.5)),
                          ),
                          trailing: isMicroblog
                              ? Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: colorScheme.primary.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    'Active',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: colorScheme.primary,
                                    ),
                                  ),
                                )
                              : Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Text(
                                    'Soon',
                                    style: TextStyle(fontSize: 10, color: Colors.grey),
                                  ),
                                ),
                          onTap: () {
                            Navigator.of(context).pop();
                            widget.onSelectModule(item['key']);
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
