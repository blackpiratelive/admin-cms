import 'package:cryptography/cryptography.dart';

class JournalSessionVault {
  static SecretKey? _activeDek;
  static bool _rememberForSession = false;

  static bool get isUnlocked => _activeDek != null;
  static SecretKey? get activeDek => _activeDek;
  static bool get rememberForSession => _rememberForSession;

  static void setUnlockedSession(SecretKey dek, {bool remember = false}) {
    _activeDek = dek;
    _rememberForSession = remember;
  }

  static void lock() {
    _activeDek = null;
    _rememberForSession = false;
  }
}
