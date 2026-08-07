import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'core/storage/app_storage.dart';
import 'shared/widgets/app_header.dart';
import 'shared/widgets/app_sidebar.dart';
import 'shared/widgets/app_drawer.dart';
import 'modules/auth/login_screen.dart';
import 'modules/microblog/microblog_list_screen.dart';
import 'modules/microblog/microblog_editor_screen.dart';
import 'modules/placeholders/placeholder_module_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PersonalCmsApp());
}

class PersonalCmsApp extends StatefulWidget {
  const PersonalCmsApp({super.key});

  @override
  State<PersonalCmsApp> createState() => _PersonalCmsAppState();
}

class _PersonalCmsAppState extends State<PersonalCmsApp> {
  String _activeTheme = 'hn';
  bool _isLoggedIn = false;
  bool _isCheckingAuth = true;

  String _activeModuleKey = 'microblog';
  bool _isEditingMicroblog = false;
  String? _editingMicroblogId;

  @override
  void initState() {
    super.initState();
    _checkInitialState();
  }

  Future<void> _checkInitialState() async {
    final theme = await AppStorage.getActiveTheme();
    final token = await AppStorage.getAuthToken();

    setState(() {
      _activeTheme = theme;
      _isLoggedIn = token != null && token.isNotEmpty;
      _isCheckingAuth = false;
    });
  }

  void _handleThemeChange(String newTheme) {
    setState(() {
      _activeTheme = newTheme;
    });
  }

  void _handleLogout() async {
    await AppStorage.logout();
    setState(() {
      _isLoggedIn = false;
      _isEditingMicroblog = false;
      _editingMicroblogId = null;
    });
  }

  void _handleSelectModule(String key) {
    setState(() {
      _activeModuleKey = key;
      _isEditingMicroblog = false;
      _editingMicroblogId = null;
    });
  }

  void _handleOpenEditor(String? editId) {
    setState(() {
      _isEditingMicroblog = true;
      _editingMicroblogId = editId;
    });
  }

  void _handleBackToList() {
    setState(() {
      _isEditingMicroblog = false;
      _editingMicroblogId = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isCheckingAuth) {
      return MaterialApp(
        theme: AppTheme.buildTheme('hn'),
        home: const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return MaterialApp(
      title: 'Personal CMS',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.buildTheme(_activeTheme),
      home: _isLoggedIn
          ? _buildMainLayout(context)
          : LoginScreen(
              onLoginSuccess: () {
                setState(() => _isLoggedIn = true);
              },
            ),
    );
  }

  Widget _buildMainLayout(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktopOrTablet = constraints.maxWidth >= 700;

        Widget contentWidget;
        if (_activeModuleKey == 'microblog') {
          if (_isEditingMicroblog) {
            contentWidget = MicroblogEditorScreen(
              editId: _editingMicroblogId,
              activeThemeKey: _activeTheme,
              onBackToList: _handleBackToList,
            );
          } else {
            contentWidget = MicroblogListScreen(
              activeThemeKey: _activeTheme,
              onOpenEditor: _handleOpenEditor,
            );
          }
        } else {
          contentWidget = PlaceholderModuleScreen(moduleKey: _activeModuleKey);
        }

        return Scaffold(
          appBar: AppHeader(
            activeThemeKey: _activeTheme,
            onThemeChanged: _handleThemeChange,
            onSelectModule: _handleSelectModule,
            onLogout: _handleLogout,
          ),
          drawer: !isDesktopOrTablet
              ? AppDrawer(
                  activeModuleKey: _activeModuleKey,
                  onSelectModule: _handleSelectModule,
                )
              : null,
          body: Row(
            children: [
              if (isDesktopOrTablet)
                AppSidebar(
                  activeModuleKey: _activeModuleKey,
                  onSelectModule: _handleSelectModule,
                ),
              Expanded(child: contentWidget),
            ],
          ),
        );
      },
    );
  }
}
