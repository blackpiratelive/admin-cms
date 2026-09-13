import 'package:flutter/cupertino.dart';
import '../core/theme/cupertino_theme.dart';
import 'directory_screen.dart';
import 'settings_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  final VoidCallback onLogout;

  const MainNavigationScreen({
    super.key,
    required this.onLogout,
  });

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  final CupertinoTabController _tabController = CupertinoTabController();

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoTabScaffold(
      controller: _tabController,
      tabBar: CupertinoTabBar(
        activeColor: AppCupertinoTheme.brandAccent,
        inactiveColor: CupertinoColors.systemGrey,
        backgroundColor: CupertinoDynamicColor.resolve(
          AppCupertinoTheme.barBackground,
          context,
        ),
        iconSize: 22,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(CupertinoIcons.person_2),
            activeIcon: Icon(CupertinoIcons.person_2_fill),
            label: 'People',
          ),
          BottomNavigationBarItem(
            icon: Icon(CupertinoIcons.gear_alt),
            activeIcon: Icon(CupertinoIcons.gear_alt_fill),
            label: 'Settings',
          ),
        ],
      ),
      tabBuilder: (context, index) {
        switch (index) {
          case 0:
            return CupertinoTabView(
              builder: (ctx) => DirectoryScreen(onLogout: widget.onLogout),
            );
          case 1:
            return CupertinoTabView(
              builder: (ctx) => SettingsScreen(onLogout: widget.onLogout),
            );
          default:
            return const SizedBox.shrink();
        }
      },
    );
  }
}
