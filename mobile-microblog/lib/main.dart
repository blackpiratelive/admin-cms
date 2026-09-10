import 'package:flutter/cupertino.dart';
import 'core/theme/cupertino_theme.dart';
import 'core/storage/local_store.dart';
import 'screens/timeline_screen.dart';
import 'screens/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CupertinoMicroblogApp());
}

class CupertinoMicroblogApp extends StatefulWidget {
  const CupertinoMicroblogApp({super.key});

  @override
  State<CupertinoMicroblogApp> createState() => _CupertinoMicroblogAppState();
}

class _CupertinoMicroblogAppState extends State<CupertinoMicroblogApp> {
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
      title: 'Microblog',
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
              ? TimelineScreen(onLogout: _handleLogout)
              : LoginScreen(onLoginSuccess: _handleLoginSuccess),
    );
  }
}
