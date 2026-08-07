import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'dart:async';
import '../../core/theme/app_theme.dart';
import '../../core/storage/app_storage.dart';
import '../../core/storage/offline_store.dart';
import 'command_palette.dart';
import 'toast_notification.dart';

class AppHeader extends StatefulWidget implements PreferredSizeWidget {
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
  State<AppHeader> createState() => _AppHeaderState();
}

class _AppHeaderState extends State<AppHeader> {
  int _unsavedCount = 0;
  bool _isSyncing = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _checkUnsavedCount();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) => _checkUnsavedCount());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _checkUnsavedCount() async {
    final count = await OfflineStore.getUnsavedCount();
    if (mounted && count != _unsavedCount) {
      setState(() => _unsavedCount = count);
    }
  }

  Future<void> _handleSync() async {
    setState(() => _isSyncing = true);
    final success = await OfflineStore.syncPendingChanges();
    await _checkUnsavedCount();
    if (mounted) {
      setState(() => _isSyncing = false);
      if (success) {
        ToastNotification.show(context, title: 'Sync Complete', message: 'All local changes synced with cloud.');
      } else {
        ToastNotification.show(context, title: 'Sync Partial', message: 'Some changes remain offline.', isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppTheme.colorsForTheme(widget.activeThemeKey);
    final isMobile = MediaQuery.of(context).size.width < 700;

    return Container(
      color: colors.headerBg,
      child: SafeArea(
        bottom: false,
        child: SizedBox(
          height: widget.preferredSize.height,
          child: Padding(
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
                        color: colors.headerText.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: colors.headerText.withValues(alpha: 0.3)),
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

                // Unsaved Changes Indicator Pill
                InkWell(
                  onTap: _unsavedCount > 0 && !_isSyncing ? _handleSync : null,
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _unsavedCount > 0 ? Colors.orange.withValues(alpha: 0.25) : Colors.green.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: _unsavedCount > 0 ? Colors.orange : Colors.green.withValues(alpha: 0.5),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_isSyncing)
                          const SizedBox(
                            width: 12,
                            height: 12,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.orange),
                          )
                        else
                          Icon(
                            _unsavedCount > 0 ? LucideIcons.cloudUpload : LucideIcons.cloudCheck,
                            size: 13,
                            color: _unsavedCount > 0 ? Colors.orange : Colors.green,
                          ),
                        const SizedBox(width: 5),
                        Text(
                          _unsavedCount > 0 ? '$_unsavedCount Unsaved' : 'Synced',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _unsavedCount > 0 ? Colors.orange : Colors.green,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),

                // Search Everything Button (Ctrl+K)
                if (!isMobile)
                  InkWell(
                    onTap: () {
                      showDialog(
                        context: context,
                        builder: (ctx) => CommandPaletteModal(onSelectModule: widget.onSelectModule),
                      );
                    },
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: colors.headerText.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: colors.headerText.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(LucideIcons.search, size: 14, color: colors.headerText.withValues(alpha: 0.8)),
                          const SizedBox(width: 6),
                          Text(
                            'Search Everything...',
                            style: TextStyle(fontSize: 12, color: colors.headerText.withValues(alpha: 0.8)),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: colors.headerText.withValues(alpha: 0.2),
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
                        builder: (ctx) => CommandPaletteModal(onSelectModule: widget.onSelectModule),
                      );
                    },
                  ),

                const SizedBox(width: 12),

                // Theme Switcher Dropdown
                DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: widget.activeThemeKey,
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
                        widget.onThemeChanged(newTheme);
                        AppStorage.setActiveTheme(newTheme);
                      }
                    },
                  ),
                ),

                const SizedBox(width: 12),

                // Logout Button
                OutlinedButton.icon(
                  onPressed: widget.onLogout,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    side: BorderSide(color: colors.headerText.withValues(alpha: 0.4)),
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
          ),
        ),
      ),
    );
  }
}
