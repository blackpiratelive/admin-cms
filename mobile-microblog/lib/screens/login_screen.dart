import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/network/api_service.dart';
import '../core/storage/local_store.dart';
import '../core/theme/cupertino_theme.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onLoginSuccess;

  const LoginScreen({
    super.key,
    required this.onLoginSuccess,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _urlController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadSavedUrl();
  }

  Future<void> _loadSavedUrl() async {
    final url = await LocalStore.getServerUrl();
    _urlController.text = url;
  }

  @override
  void dispose() {
    _urlController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final url = _urlController.text.trim();
    final password = _passwordController.text;

    if (url.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'Please enter both Server URL and Password.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    HapticFeedback.lightImpact();

    try {
      final success = await ApiService.login(url, password);
      if (success && mounted) {
        setState(() => _isLoading = false);
        widget.onLoginSuccess();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: CupertinoColors.systemGroupedBackground,
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo / App Glyph
                  Center(
                    child: Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            CupertinoColors.systemBlue,
                            CupertinoColors.systemIndigo,
                          ],
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: CupertinoColors.systemBlue.withValues(alpha: 0.3),
                            offset: const Offset(0, 8),
                            blurRadius: 16,
                          ),
                        ],
                      ),
                      child: const Icon(
                        CupertinoIcons.pencil_ellipsis_rectangle,
                        color: CupertinoColors.white,
                        size: 42,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Header Texts
                  const Text(
                    'Microblog',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Connect to your Personal Knowledge CMS',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: CupertinoColors.secondaryLabel.resolveFrom(context),
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Form Container
                  Container(
                    decoration: BoxDecoration(
                      color: AppCupertinoTheme.cardBackground.resolveFrom(context),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: AppCupertinoTheme.cardBorder.resolveFrom(context),
                      ),
                    ),
                    child: Column(
                      children: [
                        // Server URL Field
                        CupertinoTextField(
                          controller: _urlController,
                          placeholder: 'Server URL (e.g. http://localhost:3000)',
                          keyboardType: TextInputType.url,
                          padding: const EdgeInsets.all(14),
                          prefix: const Padding(
                            padding: EdgeInsets.only(left: 14),
                            child: Icon(CupertinoIcons.globe, size: 20),
                          ),
                          decoration: null,
                        ),
                        Container(
                          height: 0.5,
                          color: AppCupertinoTheme.cardBorder.resolveFrom(context),
                        ),
                        // Password Field
                        CupertinoTextField(
                          controller: _passwordController,
                          placeholder: 'Admin Password',
                          obscureText: _obscurePassword,
                          padding: const EdgeInsets.all(14),
                          prefix: const Padding(
                            padding: EdgeInsets.only(left: 14),
                            child: Icon(CupertinoIcons.lock, size: 20),
                          ),
                          suffix: CupertinoButton(
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            minimumSize: Size.zero,
                            onPressed: () {
                              setState(() => _obscurePassword = !_obscurePassword);
                            },
                            child: Icon(
                              _obscurePassword
                                  ? CupertinoIcons.eye
                                  : CupertinoIcons.eye_slash,
                              size: 18,
                              color: CupertinoColors.secondaryLabel.resolveFrom(context),
                            ),
                          ),
                          decoration: null,
                          onSubmitted: (_) => _handleLogin(),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    alignment: WrapAlignment.center,
                    children: [
                      CupertinoButton(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        minimumSize: Size.zero,
                        onPressed: () {
                          setState(() => _urlController.text = 'http://localhost:3000');
                          HapticFeedback.lightImpact();
                        },
                        child: const Text('localhost:3000', style: TextStyle(fontSize: 12)),
                      ),
                      CupertinoButton(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        minimumSize: Size.zero,
                        onPressed: () {
                          setState(() => _urlController.text = 'http://10.0.2.2:3000');
                          HapticFeedback.lightImpact();
                        },
                        child: const Text('10.0.2.2:3000 (Emulator)', style: TextStyle(fontSize: 12)),
                      ),
                    ],
                  ),

                  // Error Message
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _errorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: CupertinoColors.systemRed,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),

                  // Sign In Button
                  CupertinoButton.filled(
                    onPressed: _isLoading ? null : _handleLogin,
                    borderRadius: BorderRadius.circular(14),
                    child: _isLoading
                        ? const CupertinoActivityIndicator(color: CupertinoColors.white)
                        : const Text(
                            'Sign In',
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
