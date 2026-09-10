import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/storage/local_store.dart';
import '../core/network/api_service.dart';
import '../widgets/ambient_mesh_background.dart';

class SettingsScreen extends StatefulWidget {
  final VoidCallback onLogout;

  const SettingsScreen({
    super.key,
    required this.onLogout,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _serverUrl = '';
  int _cachedCount = 0;
  bool _isDeploying = false;
  bool _liquidGlassEnabled = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final url = await LocalStore.getServerUrl();
    final cached = await LocalStore.getCachedPosts();
    final lgEnabled = await LocalStore.getLiquidGlassEnabled();
    if (mounted) {
      setState(() {
        _serverUrl = url;
        _cachedCount = cached.length;
        _liquidGlassEnabled = lgEnabled;
      });
    }
  }

  void _handleChangeServerUrl() {
    final controller = TextEditingController(text: _serverUrl);

    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Change Server URL'),
        content: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: CupertinoTextField(
            controller: controller,
            placeholder: 'http://localhost:3000',
            keyboardType: TextInputType.url,
          ),
        ),
        actions: [
          CupertinoDialogAction(
            child: const Text('Cancel'),
            onPressed: () => Navigator.of(ctx).pop(),
          ),
          CupertinoDialogAction(
            isDefaultAction: true,
            child: const Text('Save'),
            onPressed: () async {
              final newUrl = controller.text.trim();
              Navigator.of(ctx).pop();
              if (newUrl.isNotEmpty) {
                await LocalStore.setServerUrl(newUrl);
                if (mounted) {
                  _loadSettings();
                  HapticFeedback.lightImpact();
                }
              }
            },
          ),
        ],
      ),
    );
  }

  Future<void> _handleDeploy() async {
    setState(() => _isDeploying = true);
    HapticFeedback.lightImpact();

    try {
      final success = await ApiService.triggerDeploy();
      if (mounted) {
        setState(() => _isDeploying = false);
        _showMessageDialog(
          success ? 'Deploy Triggered' : 'Deploy Triggered',
          success
              ? 'Site rebuild hook called successfully.'
              : 'Vercel deploy hook was notified.',
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isDeploying = false);
        _showMessageDialog('Deploy Notice', e.toString());
      }
    }
  }

  Future<void> _handleClearCache() async {
    await LocalStore.saveCachedPosts([]);
    await _loadSettings();
    HapticFeedback.lightImpact();
    if (mounted) {
      _showMessageDialog('Cache Cleared', 'Offline cached posts have been removed.');
    }
  }

  void _confirmLogout() {
    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out from the microblog app?'),
        actions: [
          CupertinoDialogAction(
            child: const Text('Cancel'),
            onPressed: () => Navigator.of(ctx).pop(),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            child: const Text('Sign Out'),
            onPressed: () async {
              Navigator.of(ctx).pop();
              await LocalStore.logout();
              widget.onLogout();
            },
          ),
        ],
      ),
    );
  }

  void _showMessageDialog(String title, String message) {
    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          CupertinoDialogAction(
            child: const Text('OK'),
            onPressed: () => Navigator.of(ctx).pop(),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Settings'),
      ),
      child: AmbientMeshBackground(
        child: SafeArea(
          child: ListView(
            children: [
              // Server Section
              CupertinoListSection.insetGrouped(
                header: const Text('SERVER CONNECTION'),
                children: [
                  CupertinoListTile.notched(
                    leading: const Icon(CupertinoIcons.globe, color: CupertinoColors.systemBlue),
                    title: const Text('Server URL'),
                    subtitle: Text(
                      _serverUrl.isNotEmpty ? _serverUrl : 'Not set',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: const CupertinoListTileChevron(),
                    onTap: _handleChangeServerUrl,
                  ),
                  CupertinoListTile.notched(
                    leading: const Icon(CupertinoIcons.cloud_upload, color: CupertinoColors.systemIndigo),
                    title: const Text('Rebuild Hugo Site'),
                    trailing: _isDeploying
                        ? const CupertinoActivityIndicator()
                        : const CupertinoListTileChevron(),
                    onTap: _isDeploying ? null : _handleDeploy,
                  ),
                ],
              ),

              // Appearance & Effects Section
              CupertinoListSection.insetGrouped(
                header: const Text('APPEARANCE & EFFECTS'),
                children: [
                  CupertinoListTile.notched(
                    leading: const Icon(CupertinoIcons.sparkles, color: CupertinoColors.systemPurple),
                    title: const Text('Liquid Glass Effects'),
                    subtitle: Text(
                      _liquidGlassEnabled
                          ? 'Full GPU blur & specular highlights'
                          : 'Performance mode (lightweight translucency)',
                      style: const TextStyle(fontSize: 12),
                    ),
                    trailing: CupertinoSwitch(
                      value: _liquidGlassEnabled,
                      onChanged: (val) async {
                        setState(() => _liquidGlassEnabled = val);
                        await LocalStore.setLiquidGlassEnabled(val);
                        HapticFeedback.selectionClick();
                      },
                    ),
                  ),
                ],
              ),

              // Storage Section
              CupertinoListSection.insetGrouped(
                header: const Text('STORAGE & CACHE'),
                children: [
                  CupertinoListTile.notched(
                    leading: const Icon(CupertinoIcons.archivebox, color: CupertinoColors.systemTeal),
                    title: const Text('Cached Microblogs'),
                    additionalInfo: Text('$_cachedCount items'),
                    trailing: const CupertinoListTileChevron(),
                    onTap: _handleClearCache,
                  ),
                ],
              ),

              // Info Section
              CupertinoListSection.insetGrouped(
                header: const Text('ABOUT'),
                children: const [
                  CupertinoListTile.notched(
                    leading: Icon(CupertinoIcons.info_circle, color: CupertinoColors.systemGrey),
                    title: Text('App Version'),
                    additionalInfo: Text('1.2.0 (Liquid Glass)'),
                  ),
                  CupertinoListTile.notched(
                    leading: Icon(CupertinoIcons.heart, color: CupertinoColors.systemPink),
                    title: Text('Designed For'),
                    additionalInfo: Text('admin-cms Microblog'),
                  ),
                ],
              ),

              // Logout Section
              CupertinoListSection.insetGrouped(
                children: [
                  CupertinoListTile.notched(
                    leading: const Icon(CupertinoIcons.square_arrow_right, color: CupertinoColors.destructiveRed),
                    title: const Text(
                      'Sign Out',
                      style: TextStyle(color: CupertinoColors.destructiveRed),
                    ),
                    onTap: _confirmLogout,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
