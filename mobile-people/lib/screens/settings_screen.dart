import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/storage/local_store.dart';
import '../core/network/api_service.dart';
import '../core/network/sync_service.dart';
import '../core/services/image_cache_manager.dart';
import '../core/services/notification_service.dart';
import '../core/theme/cupertino_theme.dart';

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
  DateTime? _lastSyncTime;
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
    final lastSync = await LocalStore.getLastSyncTime();

    if (mounted) {
      setState(() {
        _serverUrl = url;
        _cachedCount = cached.length;
        _offlineQueueCount = queue.length;
        _lastSyncTime = lastSync;
      });
    }
  }

  String _formatLastSync(DateTime? time) {
    if (time == null) return 'Never synced';
    final diff = DateTime.now().difference(time);
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  Future<void> _handleProcessSyncQueue() async {
    setState(() => _isSyncing = true);
    HapticFeedback.lightImpact();

    try {
      final processed = await SyncService.processQueue();
      // Pull fresh data to fully refresh offline store
      await ApiService.getPeople(forceRefresh: true, limit: 500);
      await ApiService.getUpcomingBirthdays(forceRefresh: true);
      await _loadSettings();
      if (mounted) {
        _showSuccessDialog('Sync Complete', 'Synchronized contact circle and processed $processed pending mutations.');
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
    await PeopleImageCacheManager.clearCache();
    await _loadSettings();
    HapticFeedback.mediumImpact();
    if (mounted) {
      _showSuccessDialog('Cache Cleared', 'Offline cached contacts, birthdays, and disk image cache have been cleared.');
    }
  }

  Future<void> _handleTestNotification() async {
    HapticFeedback.lightImpact();
    await NotificationService.showNotification(
      id: 9999,
      title: '🎉 Important Date Reminder Test',
      body: 'This is a test notification from your People relationship hub!',
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
        content: const Text('Are you sure you want to sign out from the People app?'),
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
              await LocalStore.clearAllCache();
              widget.onLogout();
            },
          ),
        ],
      ),
    );
  }

  Widget _buildIconTile(IconData icon, Color backgroundColor) {
    return Container(
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(7),
      ),
      alignment: Alignment.center,
      child: Icon(
        icon,
        color: CupertinoColors.white,
        size: 18,
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
          padding: const EdgeInsets.symmetric(vertical: 12),
          children: [
            // Section 1: Server Connection
            CupertinoListSection.insetGrouped(
              header: const Text('SERVER CONNECTION'),
              children: [
                CupertinoListTile(
                  leading: _buildIconTile(CupertinoIcons.globe, AppCupertinoTheme.brandAccent),
                  title: const Text('Server URL'),
                  subtitle: Text(
                    _serverUrl.isNotEmpty ? _serverUrl : 'Not configured',
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: const CupertinoListTileChevron(),
                  onTap: _showEditUrlDialog,
                ),
              ],
            ),

            // Section 2: Offline & Sync Queue
            CupertinoListSection.insetGrouped(
              header: const Text('OFFLINE & SYNC QUEUE'),
              children: [
                CupertinoListTile(
                  leading: _buildIconTile(CupertinoIcons.cloud_upload, const Color(0xFFFF9500)),
                  title: const Text('Queued Mutations'),
                  subtitle: Text(
                    '$_offlineQueueCount pending offline edits',
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: _isSyncing
                      ? const CupertinoActivityIndicator()
                      : (_offlineQueueCount > 0
                          ? CupertinoButton(
                              padding: EdgeInsets.zero,
                              onPressed: _handleProcessSyncQueue,
                              child: const Text('Sync Now', style: TextStyle(fontSize: 14)),
                            )
                          : Text(
                              'Up to date',
                              style: TextStyle(
                                fontSize: 14,
                                color: AppCupertinoTheme.secondary(context),
                              ),
                            )),
                ),
                CupertinoListTile(
                  leading: _buildIconTile(CupertinoIcons.archivebox_fill, const Color(0xFF5856D6)),
                  title: const Text('Cached Contacts'),
                  subtitle: Text(
                    '$_cachedCount contacts cached • 7-day TTL • Last sync: ${_formatLastSync(_lastSyncTime)}',
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: CupertinoButton(
                    padding: EdgeInsets.zero,
                    onPressed: _handleClearCache,
                    child: const Text('Clear', style: TextStyle(color: CupertinoColors.systemRed, fontSize: 14)),
                  ),
                ),
                CupertinoListTile(
                  leading: _buildIconTile(CupertinoIcons.arrow_clockwise, AppCupertinoTheme.brandAccent),
                  title: const Text('Force Sync All'),
                  subtitle: const Text('Refresh contacts, birthdays & process queue', style: TextStyle(fontSize: 12)),
                  trailing: _isSyncing ? const CupertinoActivityIndicator() : const CupertinoListTileChevron(),
                  onTap: _isSyncing ? null : _handleProcessSyncQueue,
                ),
              ],
            ),

            // Section 3: Push Notifications
            CupertinoListSection.insetGrouped(
              header: const Text('NOTIFICATIONS'),
              children: [
                CupertinoListTile(
                  leading: _buildIconTile(CupertinoIcons.bell_fill, const Color(0xFFFF2D55)),
                  title: const Text('Test Notification'),
                  subtitle: const Text('Trigger immediate birthday reminder', style: TextStyle(fontSize: 12)),
                  trailing: const CupertinoListTileChevron(),
                  onTap: _handleTestNotification,
                ),
              ],
            ),

            // Section 4: Static Hugo Publishing
            CupertinoListSection.insetGrouped(
              header: const Text('STATIC HUGO PUBLISHING'),
              children: [
                CupertinoListTile(
                  leading: _buildIconTile(CupertinoIcons.arrow_2_circlepath, const Color(0xFF34C759)),
                  title: const Text('Rebuild Hugo Site'),
                  subtitle: const Text('Trigger Vercel deploy hook', style: TextStyle(fontSize: 12)),
                  trailing: _isDeploying
                      ? const CupertinoActivityIndicator()
                      : const CupertinoListTileChevron(),
                  onTap: _isDeploying ? null : _handleDeploy,
                ),
              ],
            ),

            // Section 5: Account & About
            CupertinoListSection.insetGrouped(
              header: const Text('ACCOUNT & ABOUT'),
              children: [
                CupertinoListTile(
                  leading: const Icon(CupertinoIcons.info, color: CupertinoColors.systemGrey),
                  title: const Text('App Version'),
                  trailing: Text('1.5.0 (Offline First)', style: TextStyle(color: AppCupertinoTheme.secondary(context))),
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
