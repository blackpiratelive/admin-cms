import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart';

class JournalCryptoEngine {
  static const int defaultMemorySize = 65536; // 64MB
  static const int defaultIterations = 3;
  static const int defaultParallelism = 1;

  static String generateSalt() {
    final random = Random.secure();
    final bytes = Uint8List.fromList(List<int>.generate(16, (_) => random.nextInt(256)));
    return base64Encode(bytes);
  }

  static String generateIv() {
    final random = Random.secure();
    final bytes = Uint8List.fromList(List<int>.generate(12, (_) => random.nextInt(256)));
    return base64Encode(bytes);
  }

  // Derive Key Encryption Key (KEK) using Argon2id
  static Future<SecretKey> deriveKEK(
    String password,
    String saltBase64, {
    int memorySize = defaultMemorySize,
    int iterations = defaultIterations,
    int parallelism = defaultParallelism,
  }) async {
    final saltBytes = base64Decode(saltBase64);
    final kdf = Argon2id(
      memory: memorySize,
      iterations: iterations,
      parallelism: parallelism,
      hashLength: 32,
    );

    return await kdf.deriveKeyFromPassword(
      password: password,
      nonce: saltBytes,
    );
  }

  // Generate random 256-bit DEK
  static Future<List<int>> generateRawDEK() async {
    final random = Random.secure();
    return List<int>.generate(32, (_) => random.nextInt(256));
  }

  // Wrap DEK with KEK (AES-256-GCM)
  static Future<Map<String, String>> wrapDEK(List<int> rawDekBytes, SecretKey kek) async {
    final algorithm = AesGcm.with256bits();
    final ivBytes = base64Decode(generateIv());

    final secretBox = await algorithm.encrypt(
      rawDekBytes,
      secretKey: kek,
      nonce: ivBytes,
    );

    final combinedCiphertext = secretBox.concatenation();
    return {
      'encryptedDek': base64Encode(combinedCiphertext),
      'iv': base64Encode(ivBytes),
    };
  }

  // Unwrap DEK with KEK (AES-256-GCM)
  static Future<SecretKey> unwrapDEK(
    String encryptedDekBase64,
    String ivBase64,
    SecretKey kek,
  ) async {
    final algorithm = AesGcm.with256bits();
    final ivBytes = base64Decode(ivBase64);
    final combinedBytes = base64Decode(encryptedDekBase64);

    // AesGcm concatenation in cryptography package is: ciphertext + mac (16 bytes)
    final macLength = 16;
    final ciphertext = combinedBytes.sublist(0, combinedBytes.length - macLength);
    final mac = Mac(combinedBytes.sublist(combinedBytes.length - macLength));

    final secretBox = SecretBox(
      ciphertext,
      nonce: ivBytes,
      mac: mac,
    );

    final decryptedBytes = await algorithm.decrypt(
      secretBox,
      secretKey: kek,
    );

    return SecretKey(decryptedBytes);
  }

  // Encrypt plaintext with DEK
  static Future<Map<String, String>> encryptText(String plaintext, SecretKey dek) async {
    final algorithm = AesGcm.with256bits();
    final ivBytes = base64Decode(generateIv());
    final plaintextBytes = utf8.encode(plaintext);

    final secretBox = await algorithm.encrypt(
      plaintextBytes,
      secretKey: dek,
      nonce: ivBytes,
    );

    final combinedCiphertext = secretBox.concatenation();
    return {
      'ciphertext': base64Encode(combinedCiphertext),
      'iv': base64Encode(ivBytes),
    };
  }

  // Decrypt ciphertext with DEK
  static Future<String> decryptText(
    String ciphertextBase64,
    String ivBase64,
    SecretKey dek,
  ) async {
    if (ciphertextBase64.trim().isEmpty) return '';

    final algorithm = AesGcm.with256bits();
    final ivBytes = base64Decode(ivBase64);
    final combinedBytes = base64Decode(ciphertextBase64);

    final macLength = 16;
    final ciphertext = combinedBytes.sublist(0, combinedBytes.length - macLength);
    final mac = Mac(combinedBytes.sublist(combinedBytes.length - macLength));

    final secretBox = SecretBox(
      ciphertext,
      nonce: ivBytes,
      mac: mac,
    );

    final decryptedBytes = await algorithm.decrypt(
      secretBox,
      secretKey: dek,
    );

    return utf8.decode(decryptedBytes);
  }

  // Encrypt raw byte array (for E2EE images & attachments)
  static Future<Map<String, dynamic>> encryptBytes(List<int> bytes, SecretKey dek) async {
    final algorithm = AesGcm.with256bits();
    final ivBytes = base64Decode(generateIv());

    final secretBox = await algorithm.encrypt(
      bytes,
      secretKey: dek,
      nonce: ivBytes,
    );

    final combinedCiphertext = secretBox.concatenation();
    return {
      'encryptedBytes': combinedCiphertext,
      'iv': base64Encode(ivBytes),
    };
  }

  // Decrypt raw byte array (for E2EE images & attachments)
  static Future<List<int>> decryptBytes(List<int> combinedBytes, String ivBase64, SecretKey dek) async {
    final algorithm = AesGcm.with256bits();
    final ivBytes = base64Decode(ivBase64);

    final macLength = 16;
    final ciphertext = combinedBytes.sublist(0, combinedBytes.length - macLength);
    final mac = Mac(combinedBytes.sublist(combinedBytes.length - macLength));

    final secretBox = SecretBox(
      ciphertext,
      nonce: ivBytes,
      mac: mac,
    );

    return await algorithm.decrypt(
      secretBox,
      secretKey: dek,
    );
  }

  // Helper to extract clean plaintext from Lexical JSON AST structure
  static String extractPlaintextFromLexicalState(String lexicalJsonStr) {
    if (lexicalJsonStr.trim().isEmpty) return '';
    try {
      final state = jsonDecode(lexicalJsonStr);
      final StringBuffer buffer = StringBuffer();

      void traverse(dynamic node) {
        if (node is Map) {
          if (node.containsKey('text') && node['text'] is String) {
            buffer.write('${node['text']} ');
          }
          if (node.containsKey('children') && node['children'] is List) {
            for (final child in node['children']) {
              traverse(child);
            }
          }
        }
      }

      if (state is Map && state.containsKey('root')) {
        traverse(state['root']);
      }
      return buffer.toString().replaceAll(RegExp(r'\s+'), ' ').trim();
    } catch (_) {
      return lexicalJsonStr;
    }
  }

  // Helper to convert plain markdown/text into valid Lexical JSON AST for Web CMS compatibility
  static String buildLexicalStateFromText(String text) {
    if (text.trim().isEmpty) {
      return jsonEncode({
        'root': {'children': [], 'direction': null, 'format': '', 'indent': 0, 'type': 'root', 'version': 1}
      });
    }

    final paragraphs = text.split('\n\n').where((p) => p.trim().isNotEmpty).toList();
    final children = paragraphs.map((p) => {
      'children': [
        {
          'detail': 0,
          'format': 0,
          'mode': 'normal',
          'style': '',
          'text': p.trim(),
          'type': 'text',
          'version': 1,
        }
      ],
      'direction': 'ltr',
      'format': '',
      'indent': 0,
      'type': 'paragraph',
      'version': 1,
      'textFormat': 0,
    }).toList();

    return jsonEncode({
      'root': {
        'children': children,
        'direction': 'ltr',
        'format': '',
        'indent': 0,
        'type': 'root',
        'version': 1,
      }
    });
  }

  // Verify DEK against verificationPayload
  static Future<bool> verifyDEK(
    SecretKey dek,
    String verificationPayloadBase64,
    String verificationIvBase64,
  ) async {
    try {
      final decrypted = await decryptText(
        verificationPayloadBase64,
        verificationIvBase64,
        dek,
      );
      return decrypted == 'VERIFIED_JOURNAL_KEY';
    } catch (_) {
      return false;
    }
  }
}
