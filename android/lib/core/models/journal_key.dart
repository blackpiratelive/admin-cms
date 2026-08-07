class JournalKeyRecord {
  final String id;
  final String encryptedDek;
  final String salt;
  final String iv;
  final String algorithm;
  final String kdf;
  final int argonMemory;
  final int argonIterations;
  final int argonParallelism;
  final int keyVersion;

  JournalKeyRecord({
    required this.id,
    required this.encryptedDek,
    required this.salt,
    required this.iv,
    required this.algorithm,
    required this.kdf,
    required this.argonMemory,
    required this.argonIterations,
    required this.argonParallelism,
    required this.keyVersion,
  });

  factory JournalKeyRecord.fromJson(Map<String, dynamic> json) {
    return JournalKeyRecord(
      id: json['id'] as String? ?? 'default',
      encryptedDek: json['encryptedDek'] as String? ?? json['encrypted_dek'] as String? ?? '',
      salt: json['salt'] as String? ?? '',
      iv: json['iv'] as String? ?? '',
      algorithm: json['algorithm'] as String? ?? 'AES-256-GCM',
      kdf: json['kdf'] as String? ?? 'Argon2id',
      argonMemory: json['argonMemory'] as int? ?? json['argon_memory'] as int? ?? 65536,
      argonIterations: json['argonIterations'] as int? ?? json['argon_iterations'] as int? ?? 3,
      argonParallelism: json['argonParallelism'] as int? ?? json['argon_parallelism'] as int? ?? 1,
      keyVersion: json['keyVersion'] as int? ?? json['key_version'] as int? ?? 1,
    );
  }
}
