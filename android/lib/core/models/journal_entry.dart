import 'dart:convert';

class JournalEntryRecord {
  final String id;
  final String slug;
  final String entryDate;
  final String entryType;
  final String? mood;
  final int favorite;
  final String visibility;
  final String? locationId;
  final String? tripId;
  final String? weatherId;
  final String encryptedContent;
  final int encryptionVersion;
  final String iv;
  final String salt;
  final int wordCount;
  final int readingTime;
  final List<String> tags;
  final String createdAt;
  final String updatedAt;

  // Decrypted fields (cached after decryption)
  String? decryptedTitle;
  String? decryptedMarkdown;
  String? decryptedLexicalState;

  JournalEntryRecord({
    required this.id,
    required this.slug,
    required this.entryDate,
    required this.entryType,
    this.mood,
    required this.favorite,
    required this.visibility,
    this.locationId,
    this.tripId,
    this.weatherId,
    required this.encryptedContent,
    required this.encryptionVersion,
    required this.iv,
    required this.salt,
    required this.wordCount,
    required this.readingTime,
    required this.tags,
    required this.createdAt,
    required this.updatedAt,
    this.decryptedTitle,
    this.decryptedMarkdown,
    this.decryptedLexicalState,
  });

  factory JournalEntryRecord.fromJson(Map<String, dynamic> json) {
    List<String> parsedTags = [];
    if (json['tags'] != null) {
      if (json['tags'] is List) {
        parsedTags = (json['tags'] as List).map((e) => e.toString()).toList();
      } else if (json['tags'] is String) {
        try {
          parsedTags = List<String>.from(jsonDecode(json['tags']));
        } catch (_) {}
      }
    }

    return JournalEntryRecord(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      entryDate: json['entryDate'] as String? ?? json['entry_date'] as String? ?? '',
      entryType: json['entryType'] as String? ?? json['entry_type'] as String? ?? 'daily',
      mood: json['mood'] as String?,
      favorite: json['favorite'] as int? ?? 0,
      visibility: json['visibility'] as String? ?? 'private',
      locationId: json['locationId'] as String? ?? json['location_id'] as String?,
      tripId: json['tripId'] as String? ?? json['trip_id'] as String?,
      weatherId: json['weatherId'] as String? ?? json['weather_id'] as String?,
      encryptedContent: json['encryptedContent'] as String? ?? json['encrypted_content'] as String? ?? '',
      encryptionVersion: json['encryptionVersion'] as int? ?? json['encryption_version'] as int? ?? 1,
      iv: json['iv'] as String? ?? '',
      salt: json['salt'] as String? ?? '',
      wordCount: json['wordCount'] as int? ?? json['word_count'] as int? ?? 0,
      readingTime: json['readingTime'] as int? ?? json['reading_time'] as int? ?? 0,
      tags: parsedTags,
      createdAt: json['createdAt'] as String? ?? json['created_at'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? json['updated_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'slug': slug,
      'entryDate': entryDate,
      'entryType': entryType,
      'mood': mood,
      'favorite': favorite,
      'visibility': visibility,
      'locationId': locationId,
      'tripId': tripId,
      'weatherId': weatherId,
      'encryptedContent': encryptedContent,
      'encryptionVersion': encryptionVersion,
      'iv': iv,
      'salt': salt,
      'wordCount': wordCount,
      'readingTime': readingTime,
      'tags': tags,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}
