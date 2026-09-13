import 'package:flutter/cupertino.dart';
import 'core/theme/cupertino_theme.dart';
import 'core/storage/local_store.dart';
import 'core/services/notification_service.dart';
import 'screens/main_navigation_screen.dart';
import 'screens/login_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService.initialize();
  runApp(const CupertinoPeopleApp());
}

class CupertinoPeopleApp extends StatefulWidget {
  const CupertinoPeopleApp({super.key});

  @override
  State<CupertinoPeopleApp> createState() => _CupertinoPeopleAppState();
}

class _CupertinoPeopleAppState extends State<CupertinoPeopleApp> {
  bool _isCheckingAuth = true;
  bool _isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final loggedIn = await LocalStore.isLoggedIn();
    if (mounted) {
      setState(() {
        _isLoggedIn = loggedIn;
        _isCheckingAuth = false;
      });
    }
  }

  void _handleLoginSuccess() {
    setState(() {
      _isLoggedIn = true;
    });
  }

  void _handleLogout() {
    setState(() {
      _isLoggedIn = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoApp(
      title: 'People',
      debugShowCheckedModeBanner: false,
      theme: AppCupertinoTheme.dynamicTheme,
      home: _isCheckingAuth
          ? const CupertinoPageScaffold(
              backgroundColor: CupertinoColors.systemGroupedBackground,
              child: Center(
                child: CupertinoActivityIndicator(radius: 14),
              ),
            )
          : _isLoggedIn
              ? MainNavigationScreen(onLogout: _handleLogout)
              : LoginScreen(onLoginSuccess: _handleLoginSuccess),
    );
  }
}
