import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'deploy_widget.dart';

class AppSidebar extends StatelessWidget {
  final String activeModuleKey;
  final Function(String moduleKey) onSelectModule;

  const AppSidebar({
    super.key,
    required this.activeModuleKey,
    required this.onSelectModule,
  });

  Widget _buildSectionTitle(BuildContext context, String title) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(left: 12, top: 16, bottom: 6),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.1,
          color: theme.colorScheme.onSurface.withOpacity(0.5),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context, {
    required String keyName,
    required String label,
    required IconData icon,
    bool isSoon = false,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isActive = activeModuleKey == keyName;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      child: Material(
        color: isActive ? colorScheme.primary.withOpacity(0.15) : Colors.transparent,
        borderRadius: BorderRadius.circular(6),
        child: InkWell(
          borderRadius: BorderRadius.circular(6),
          onTap: () => onSelectModule(keyName),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 16,
                  color: isActive ? colorScheme.primary : colorScheme.onSurface.withOpacity(0.7),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                      color: isActive ? colorScheme.primary : colorScheme.onSurface,
                    ),
                  ),
                ),
                if (isSoon)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    decoration: BoxDecoration(
                      color: colorScheme.onSurface.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(3),
                    ),
                    child: Text(
                      'soon',
                      style: TextStyle(
                        fontSize: 9,
                        color: colorScheme.onSurface.withOpacity(0.5),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      width: 240,
      decoration: BoxDecoration(
        color: colorScheme.surface,
        border: Border(
          right: BorderSide(color: colorScheme.outline.withOpacity(0.2)),
        ),
      ),
      child: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                _buildNavItem(context, keyName: 'dashboard', label: 'Dashboard', icon: LucideIcons.layoutDashboard),
                _buildNavItem(context, keyName: 'analytics', label: 'Analytics & Memory', icon: LucideIcons.barChart2),

                _buildSectionTitle(context, 'Content'),
                _buildNavItem(context, keyName: 'journal', label: 'Journal', icon: LucideIcons.bookOpen),
                _buildNavItem(context, keyName: 'microblog', label: 'Microblog', icon: LucideIcons.messageSquare),
                _buildNavItem(context, keyName: 'blog', label: 'Blog', icon: LucideIcons.fileText, isSoon: true),
                _buildNavItem(context, keyName: 'notes', label: 'Notes', icon: LucideIcons.stickyNote, isSoon: true),
                _buildNavItem(context, keyName: 'pages', label: 'Pages', icon: LucideIcons.file, isSoon: true),

                _buildSectionTitle(context, 'Tracking'),
                _buildNavItem(context, keyName: 'todos', label: 'Todos', icon: LucideIcons.checkSquare),
                _buildNavItem(context, keyName: 'books', label: 'Books', icon: LucideIcons.book, isSoon: true),
                _buildNavItem(context, keyName: 'games', label: 'Games', icon: LucideIcons.gamepad2, isSoon: true),

                _buildSectionTitle(context, 'Media'),
                _buildNavItem(context, keyName: 'storage', label: 'Storage', icon: LucideIcons.hardDrive),
                _buildNavItem(context, keyName: 'gallery', label: 'Gallery', icon: LucideIcons.image),
                _buildNavItem(context, keyName: 'uploads', label: 'Uploads', icon: LucideIcons.uploadCloud, isSoon: true),

                _buildSectionTitle(context, 'Collections'),
                _buildNavItem(context, keyName: 'bookmarks', label: 'Bookmarks', icon: LucideIcons.bookmark, isSoon: true),
                _buildNavItem(context, keyName: 'quotes', label: 'Quotes', icon: LucideIcons.quote, isSoon: true),
                _buildNavItem(context, keyName: 'links', label: 'Links', icon: LucideIcons.link),
              ],
            ),
          ),

          // Footer Vercel Deploy Widget
          const Padding(
            padding: EdgeInsets.all(12),
            child: DeployWidget(),
          ),
        ],
      ),
    );
  }
}
