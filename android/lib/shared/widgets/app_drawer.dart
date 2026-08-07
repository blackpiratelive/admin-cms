import 'package:flutter/material.dart';
import 'app_sidebar.dart';

class AppDrawer extends StatelessWidget {
  final String activeModuleKey;
  final Function(String moduleKey) onSelectModule;

  const AppDrawer({
    super.key,
    required this.activeModuleKey,
    required this.onSelectModule,
  });

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: SafeArea(
        child: AppSidebar(
          activeModuleKey: activeModuleKey,
          onSelectModule: (key) {
            Navigator.of(context).pop();
            onSelectModule(key);
          },
        ),
      ),
    );
  }
}
