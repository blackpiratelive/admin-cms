class JournalSettingsRecord {
  final String id;
  final String salt;
  final String verificationPayload;
  final String verificationIv;
  final int autoLockMinutes;

  JournalSettingsRecord({
    required this.id,
    required this.salt,
    required this.verificationPayload,
    required this.verificationIv,
    required this.autoLockMinutes,
  });

  factory JournalSettingsRecord.fromJson(Map<String, dynamic> json) {
    return JournalSettingsRecord(
      id: json['id'] as String? ?? 'default',
      salt: json['salt'] as String? ?? '',
      verificationPayload: json['verificationPayload'] as String? ?? json['verification_payload'] as String? ?? '',
      verificationIv: json['verificationIv'] as String? ?? json['verification_iv'] as String? ?? '',
      autoLockMinutes: json['autoLockMinutes'] as int? ?? json['auto_lock_minutes'] as int? ?? 15,
    );
  }
}
