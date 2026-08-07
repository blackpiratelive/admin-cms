import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/storage/app_storage.dart';
import 'command_palette.dart';

class AppHeader extends StatelessWidget implements PreferredSizeWidget {
  final String activeThemeKey;
  final Function(String themeKey) onThemeChanged;
  final Function(String moduleKey) onSelectModule;
  final VoidCallback onLogout;

  const AppHeader({
    super.key,
    required this.activeThemeKey,
    required this.onThemeChanged,
    required this.onSelectModule,
    required this.onLogout,
  });

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    final colors = AppTheme.colorsForTheme(activeThemeKey);
    final isMobile = MediaQuery.of(context).size.width < 700;

    return Container(
      height: preferredSize.height,
      color: colors.headerBg,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          if (isMobile)
            IconButton(
              icon: Icon(LucideIcons.menu, color: colors.headerText),
              onPressed: () => Scaffold.of(context).openDrawer(),
            ),

          // CMS Title / Badge
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.terminal, color: colors.headerText, size: 20),
              const SizedBox(width: 8),
              Text(
                'Personal CMS',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: colors.headerText,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: colors.headerText.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: colors.headerText.withOpacity(0.3)),
                ),
                child: Text(
                  'HUGO + TURSO',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'monospace',
                    color: colors.headerText,
                  ),
                ),
              ),
            ],
          ),

          const Spacer(),

          // Search Everything Button (Ctrl+K)
          if (!isMobile)
            InkWell(
              onTap: () {
                showDialog(
                  context: context,
                  builder: (ctx) => CommandPaletteModal(onSelectModule: onSelectModule),
                );
              },
              borderRadius: BorderRadius.circular(6),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: colors.headerText.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: colors.headerText.withOpacity(0.2)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.search, size: 14, color: colors.headerText.withOpacity(0.8)),
                    const SizedBox(width: 6),
                    Text(
                      'Search Everything...',
                      style: TextStyle(fontSize: 12, color: colors.headerText.withOpacity(0.8)),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: colors.headerText.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: Text(
                        'Ctrl+K',
                        style: TextStyle(fontSize: 10, color: colors.headerText, fontFamily: 'monospace'),
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            IconButton(
              icon: Icon(LucideIcons.search, color: colors.headerText, size: 18),
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => CommandPaletteModal(onSelectModule: onSelectModule),
                );
              },
            ),

          const SizedBox(width: 12),

          // Theme Switcher Dropdown
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: activeThemeKey,
              dropdownColor: colors.cardBg,
              icon: Icon(LucideIcons.palette, color: colors.headerText, size: 16),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: colors.headerText),
              items: const [
                DropdownMenuItem(value: 'hn', child: Text('HN Orange')),
                DropdownMenuItem(value: 'dark', child: Text('Dark Mode')),
                DropdownMenuItem(value: 'mono', child: Text('Mono')),
                DropdownMenuItem(value: 'teal', child: Text('Teal')),
              ],
              onChanged: (newTheme) {
                if (newTheme != null) {
                  onThemeChanged(newTheme);
                  AppStorage.setActiveTheme(newTheme);
                }
              },
            ),
          ),

          const SizedBox(width: 12),

          // Logout Button
          OutlinedButton.icon(
            onPressed: onLogout,
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              side: BorderSide(color: colors.headerText.withOpacity(0.4)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
            ),
            icon: Icon(LucideIcons.logOut, size: 13, color: colors.headerText),
            label: Text(
              'Logout',
              style: TextStyle(fontSize: 12, color: colors.headerText, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
