import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/storage/local_store.dart';
import '../core/network/api_service.dart';
import '../core/network/sync_service.dart';
import '../core/services/notification_service.dart';

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
  int _offlineQueueCount = 0;
  bool _isDeploying = false;
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final url = await LocalStore.getServerUrl();
    final cached = await LocalStore.getCachedPeople();
    final queue = await LocalStore.getOfflineQueue();

    if (mounted) {
      setState(() {
        _serverUrl = url;
        _cachedCount = cached.length;
        _offlineQueueCount = queue.length;
      });
    }
  }

  Future<void> _handleProcessSyncQueue() async {
    setState(() => _isSyncing = true);
    HapticFeedback.lightImpact();

    try {
      final processed = await SyncService.processQueue();
      await _loadSettings();
      if (mounted) {
        _showSuccessDialog('Sync Complete', 'Processed $processed pending mutations successfully.');
      }
    } catch (e) {
      if (mounted) {
        _showSuccessDialog('Sync Failed', e.toString());
      }
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  Future<void> _handleClearCache() async {
    await LocalStore.clearAllCache();
    await _loadSettings();
    HapticFeedback.mediumImpact();
    if (mounted) {
      _showSuccessDialog('Cache Cleared', 'Offline cached contacts and birthdays have been cleared.');
    }
  }

  Future<void> _handleTestNotification() async {
    HapticFeedback.lightImpact();
    await NotificationService.showNotification(
      id: 9999,
      title: '🎉 Important Date Reminder Test',
      body: 'This is a test notification from the People & Memory Hub app!',
    );
  }

  Future<void> _handleDeploy() async {
    setState(() => _isDeploying = true);
    HapticFeedback.lightImpact();

    try {
      final success = await ApiService.triggerDeploy();
      if (mounted) {
        if (success) {
          _showSuccessDialog('Deploy Triggered', 'Static Hugo site rebuild has been initiated.');
        } else {
          _showSuccessDialog('Deploy Failed', 'Failed to trigger deploy hook.');
        }
      }
    } catch (e) {
      if (mounted) {
        _showSuccessDialog('Deploy Error', e.toString());
      }
    } finally {
      if (mounted) setState(() => _isDeploying = false);
    }
  }

  void _showSuccessDialog(String title, String message) {
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

  void _showEditUrlDialog() {
    final controller = TextEditingController(text: _serverUrl);
    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Server Connection URL'),
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
                _loadSettings();
              }
            },
          ),
        ],
      ),
    );
  }

  void _confirmLogout() {
    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out of your People CMS?'),
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
              await LocalStore.clearAuth();
              widget.onLogout();
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: CupertinoColors.systemGroupedBackground,
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Settings'),
      ),
      child: SafeArea(
        child: ListView(
          children: [
            // Section 1: Server Connection
            CupertinoListSection.insetGrouped(
              header: const Text('SERVER CONNECTION'),
              children: [
                CupertinoListTile(
                  leading: const Icon(CupertinoIcons.globe, color: Color(0xFF8B5CF6)),
                  title: const Text('Server URL'),
                  subtitle: Text(_serverUrl, style: const TextStyle(fontSize: 12)),
                  trailing: const CupertinoListTileChevron(),
                  onTap: _showEditUrlDialog,
                ),
              ],
            ),


            // Section 3: Offline & Sync
            CupertinoListSection.insetGrouped(
              header: const Text('OFFLINE & SYNC QUEUE'),
              children: [
                CupertinoListTile(
                  leading: const Icon(CupertinoIcons.cloud_upload, color: CupertinoColors.systemOrange),
                  title: const Text('Queued Mutations'),
                  subtitle: Text('$_offlineQueueCount pending offline edits', style: const TextStyle(fontSize: 12)),
                  trailing: _isSyncing
                      ? const CupertinoActivityIndicator()
                      : (_offlineQueueCount > 0
                          ? CupertinoButton(
                              padding: EdgeInsets.zero,
                              onPressed: _handleProcessSyncQueue,
                              child: const Text('Sync Now', style: TextStyle(fontSize: 14)),
                            )
                          : const SizedBox.shrink()),
                ),
                CupertinoListTile(
                  leading: const Icon(CupertinoIcons.folder, color: Color(0xFF3B82F6)),
                  title: const Text('Cached Contacts'),
                  subtitle: Text('$_cachedCount contacts cached locally', style: const TextStyle(fontSize: 12)),
                  trailing: CupertinoButton(
                    padding: EdgeInsets.zero,
                    onPressed: _handleClearCache,
                    child: const Text('Clear', style: TextStyle(color: CupertinoColors.systemRed, fontSize: 14)),
                  ),
                ),
              ],
            ),

            // Section 4: Push Reminders
            CupertinoListSection.insetGrouped(
              header: const Text('NOTIFICATIONS'),
              children: [
                CupertinoListTile(
                  leading: const Icon(CupertinoIcons.bell_fill, color: Color(0xFFF59E0B)),
                  title: const Text('Test Notification'),
                  subtitle: const Text('Trigger immediate birthday reminder', style: TextStyle(fontSize: 12)),
                  trailing: const CupertinoListTileChevron(),
                  onTap: _handleTestNotification,
                ),
              ],
            ),

            // Section 5: Hugo Publishing
            CupertinoListSection.insetGrouped(
              header: const Text('STATIC HUGO PUBLISHING'),
              children: [
                CupertinoListTile(
                  leading: const Icon(CupertinoIcons.arrow_2_circlepath, color: CupertinoColors.systemGreen),
                  title: const Text('Rebuild Hugo Site'),
                  subtitle: const Text('Trigger Vercel deploy hook', style: TextStyle(fontSize: 12)),
                  trailing: _isDeploying
                      ? const CupertinoActivityIndicator()
                      : const CupertinoListTileChevron(),
                  onTap: _isDeploying ? null : _handleDeploy,
                ),
              ],
            ),

            // Section 6: About & Sign Out
            CupertinoListSection.insetGrouped(
              header: const Text('ACCOUNT & ABOUT'),
              children: [
                const CupertinoListTile(
                  leading: Icon(CupertinoIcons.info, color: CupertinoColors.systemGrey),
                  title: Text('App Version'),
                  trailing: Text('1.0.0+1', style: TextStyle(color: CupertinoColors.secondaryLabel)),
                ),
                CupertinoListTile(
                  leading: const Icon(CupertinoIcons.square_arrow_right, color: CupertinoColors.systemRed),
                  title: const Text(
                    'Sign Out',
                    style: TextStyle(color: CupertinoColors.systemRed, fontWeight: FontWeight.w600),
                  ),
                  onTap: _confirmLogout,
                ),
              ],
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}
