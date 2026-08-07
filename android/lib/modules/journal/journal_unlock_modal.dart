import 'package:flutter/material.dart';
import '../../core/crypto/journal_crypto.dart';
import '../../core/crypto/journal_session_vault.dart';
import '../../core/network/api_client.dart';
import '../../core/models/journal_key.dart';
import '../../core/models/journal_settings.dart';
import '../../shared/widgets/toast_notification.dart';

class JournalUnlockModal extends StatefulWidget {
  final VoidCallback onUnlocked;

  const JournalUnlockModal({super.key, required this.onUnlocked});

  @override
  State<JournalUnlockModal> createState() => _JournalUnlockModalState();
}

class _JournalUnlockModalState extends State<JournalUnlockModal> {
  final TextEditingController _passwordController = TextEditingController();
  bool _rememberForSession = true;
  bool _isLoading = true;
  bool _isSubmitting = false;
  bool _isObscured = true;

  bool _isInitialized = false;
  JournalKeyRecord? _keyRecord;
  JournalSettingsRecord? _settingsRecord;

  @override
  void initState() {
    super.initState();
    _checkStatus();
  }

  Future<void> _checkStatus() async {
    try {
      final status = await ApiClient.getJournalStatus();
      setState(() {
        _isInitialized = status['isInitialized'] == true;
        if (status['keyRecord'] != null) {
          _keyRecord = JournalKeyRecord.fromJson(status['keyRecord']);
        }
        if (status['settingsRecord'] != null) {
          _settingsRecord = JournalSettingsRecord.fromJson(status['settingsRecord']);
        }
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ToastNotification.show(context, title: 'Error', message: 'Failed to connect to journal vault: $e', isError: true);
      }
    }
  }

  Future<void> _handleUnlockOrSetup() async {
    final password = _passwordController.text.trim();
    if (password.isEmpty) {
      ToastNotification.show(context, title: 'Password Required', message: 'Please enter master password.', isError: true);
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      if (!_isInitialized) {
        // Initial Vault Setup
        final salt = JournalCryptoEngine.generateSalt();
        final kek = await JournalCryptoEngine.deriveKEK(password, salt);
        final rawDek = await JournalCryptoEngine.generateRawDEK();
        final wrapped = await JournalCryptoEngine.wrapDEK(rawDek, kek);

        final dekKey = await JournalCryptoEngine.unwrapDEK(wrapped['encryptedDek']!, wrapped['iv']!, kek);
        final verification = await JournalCryptoEngine.encryptText('VERIFIED_JOURNAL_KEY', dekKey);

        await ApiClient.saveJournalKeyRecord({
          'encryptedDek': wrapped['encryptedDek'],
          'salt': salt,
          'iv': wrapped['iv'],
          'algorithm': 'AES-256-GCM',
          'kdf': 'Argon2id',
          'argonMemory': 65536,
          'argonIterations': 3,
          'argonParallelism': 1,
          'keyVersion': 1,
        });

        await ApiClient.saveJournalSettings({
          'salt': salt,
          'verificationPayload': verification['ciphertext'],
          'verificationIv': verification['iv'],
          'autoLockMinutes': 15,
        });

        JournalSessionVault.setUnlockedSession(dekKey, remember: _rememberForSession);

        if (mounted) {
          ToastNotification.show(context, title: 'Vault Initialized', message: 'Personal Memory Vault created successfully.');
          widget.onUnlocked();
        }
      } else {
        // Unlock Existing Vault
        final salt = _settingsRecord?.salt.isNotEmpty == true ? _settingsRecord!.salt : _keyRecord!.salt;
        final kek = await JournalCryptoEngine.deriveKEK(
          password,
          salt,
          memorySize: _keyRecord?.argonMemory ?? 65536,
          iterations: _keyRecord?.argonIterations ?? 3,
          parallelism: _keyRecord?.argonParallelism ?? 1,
        );

        final dek = await JournalCryptoEngine.unwrapDEK(
          _keyRecord!.encryptedDek,
          _keyRecord!.iv,
          kek,
        );

        final isValid = await JournalCryptoEngine.verifyDEK(
          dek,
          _settingsRecord!.verificationPayload,
          _settingsRecord!.verificationIv,
        );

        if (!isValid) {
          throw Exception('Incorrect master password. Unable to decrypt vault key.');
        }

        JournalSessionVault.setUnlockedSession(dek, remember: _rememberForSession);

        if (mounted) {
          ToastNotification.show(context, title: 'Vault Unlocked', message: 'Decryption keys loaded to memory session.');
          widget.onUnlocked();
        }
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(context, title: 'Unlock Failed', message: e.toString().replaceAll('Exception: ', ''), isError: true);
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 440),
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 20,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: colorScheme.primary.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.shield_outlined,
                  size: 28,
                  color: colorScheme.primary,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                _isInitialized ? 'Unlock Memory Vault' : 'Initialize E2EE Memory Vault',
                style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                _isInitialized
                    ? 'Enter master password to derive KEK and unwrap DEK.'
                    : 'Create a master password for zero-knowledge end-to-end encryption.',
                style: theme.textTheme.bodyMedium?.copyWith(color: colorScheme.onSurface.withValues(alpha: 0.6)),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),

              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator()),
                )
              else ...[
                TextField(
                  controller: _passwordController,
                  obscureText: _isObscured,
                  autofocus: true,
                  decoration: InputDecoration(
                    labelText: _isInitialized ? 'Master Password' : 'New Master Password',
                    prefixIcon: const Icon(Icons.lock_outline, size: 18),
                    suffixIcon: IconButton(
                      icon: Icon(_isObscured ? Icons.visibility_off : Icons.visibility, size: 18),
                      onPressed: () => setState(() => _isObscured = !_isObscured),
                    ),
                  ),
                  onSubmitted: (_) => _handleUnlockOrSetup(),
                ),
                const SizedBox(height: 12),

                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  value: _rememberForSession,
                  onChanged: (val) => setState(() => _rememberForSession = val ?? true),
                  title: const Text(
                    'Remember for this session',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                  ),
                  subtitle: Text(
                    'Key stays in memory RAM until app is closed from Recents or locked.',
                    style: TextStyle(fontSize: 11, color: colorScheme.onSurface.withValues(alpha: 0.5)),
                  ),
                ),
                const SizedBox(height: 20),

                ElevatedButton(
                  onPressed: _isSubmitting ? null : _handleUnlockOrSetup,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    backgroundColor: colorScheme.primary,
                    foregroundColor: Colors.white,
                  ),
                  child: _isSubmitting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(
                          _isInitialized ? 'Unlock Vault' : 'Create Encrypted Vault',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
