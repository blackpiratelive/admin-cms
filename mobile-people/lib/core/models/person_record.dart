import 'dart:convert';
import 'important_date.dart';
import 'social_links.dart';

class PersonRecord {
  final String id;
  final String displayName;
  final String? firstName;
  final String? lastName;
  final String? nickname;
  final String slug;
  final String? avatarUrl;
  final String relationshipType;
  final List<ImportantDate> importantDates;
  final String? notesMarkdown;
  final List<String> interests;
  final SocialLinks socialLinks;
  final String visibility;
  final bool favorite;
  final List<String> tags;
  final String? createdAt;
  final String? updatedAt;

  const PersonRecord({
    required this.id,
    required this.displayName,
    this.firstName,
    this.lastName,
    this.nickname,
    required this.slug,
    this.avatarUrl,
    this.relationshipType = 'Friend',
    this.importantDates = const [],
    this.notesMarkdown,
    this.interests = const [],
    this.socialLinks = const SocialLinks(),
    this.visibility = 'private',
    this.favorite = false,
    this.tags = const [],
    this.createdAt,
    this.updatedAt,
  });

  factory PersonRecord.fromJson(Map<String, dynamic> json) {
    // Parse important dates
    List<ImportantDate> parsedDates = [];
    final rawDates = json['importantDates'] ?? json['importantDatesJson'];
    if (rawDates is List) {
      parsedDates = rawDates
          .map((e) => e is Map<String, dynamic> ? ImportantDate.fromJson(e) : null)
          .whereType<ImportantDate>()
          .toList();
    } else if (rawDates is String && rawDates.isNotEmpty) {
      try {
        final decoded = jsonDecode(rawDates);
        if (decoded is List) {
          parsedDates = decoded
              .map((e) => e is Map<String, dynamic> ? ImportantDate.fromJson(e) : null)
              .whereType<ImportantDate>()
              .toList();
        }
      } catch (_) {}
    }

    // Parse interests
    List<String> parsedInterests = [];
    final rawInterests = json['interests'];
    if (rawInterests is List) {
      parsedInterests = rawInterests.map((e) => e.toString().trim()).where((s) => s.isNotEmpty).toList();
    } else if (rawInterests is String && rawInterests.isNotEmpty) {
      try {
        final decoded = jsonDecode(rawInterests);
        if (decoded is List) {
          parsedInterests = decoded.map((e) => e.toString().trim()).where((s) => s.isNotEmpty).toList();
        } else {
          parsedInterests = rawInterests.split(',').map((e) => e.trim()).where((s) => s.isNotEmpty).toList();
        }
      } catch (_) {
        parsedInterests = rawInterests.split(',').map((e) => e.trim()).where((s) => s.isNotEmpty).toList();
      }
    }

    // Parse tags
    List<String> parsedTags = [];
    final rawTags = json['tags'];
    if (rawTags is List) {
      parsedTags = rawTags.map((e) => e.toString().trim()).where((s) => s.isNotEmpty).toList();
    } else if (rawTags is String && rawTags.isNotEmpty) {
      try {
        final decoded = jsonDecode(rawTags);
        if (decoded is List) {
          parsedTags = decoded.map((e) => e.toString().trim()).where((s) => s.isNotEmpty).toList();
        } else {
          parsedTags = rawTags.split(',').map((e) => e.trim()).where((s) => s.isNotEmpty).toList();
        }
      } catch (_) {
        parsedTags = rawTags.split(',').map((e) => e.trim()).where((s) => s.isNotEmpty).toList();
      }
    }

    // Parse social links
    SocialLinks parsedSocial = const SocialLinks();
    final rawSocial = json['socialLinks'] ?? json['socialLinksJson'];
    if (rawSocial is Map<String, dynamic>) {
      parsedSocial = SocialLinks.fromJson(rawSocial);
    } else if (rawSocial is String && rawSocial.isNotEmpty) {
      try {
        final decoded = jsonDecode(rawSocial);
        if (decoded is Map<String, dynamic>) {
          parsedSocial = SocialLinks.fromJson(decoded);
        }
      } catch (_) {}
    }

    final favRaw = json['favorite'];
    final isFav = favRaw == true || favRaw == 1 || favRaw == '1';

    return PersonRecord(
      id: json['id'] as String? ?? '',
      displayName: (json['displayName'] as String? ?? json['name'] as String? ?? '').trim(),
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      nickname: json['nickname'] as String?,
      slug: json['slug'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      relationshipType: json['relationshipType'] as String? ?? 'Friend',
      importantDates: parsedDates,
      notesMarkdown: json['notesMarkdown'] as String?,
      interests: parsedInterests,
      socialLinks: parsedSocial,
      visibility: json['visibility'] as String? ?? 'private',
      favorite: isFav,
      tags: parsedTags,
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'displayName': displayName,
      if (firstName != null) 'firstName': firstName,
      if (lastName != null) 'lastName': lastName,
      if (nickname != null) 'nickname': nickname,
      'slug': slug,
      if (avatarUrl != null) 'avatarUrl': avatarUrl,
      'relationshipType': relationshipType,
      'importantDates': importantDates.map((d) => d.toJson()).toList(),
      if (notesMarkdown != null) 'notesMarkdown': notesMarkdown,
      'interests': interests,
      'socialLinks': socialLinks.toJson(),
      'visibility': visibility,
      'favorite': favorite ? 1 : 0,
      'tags': tags,
      if (createdAt != null) 'createdAt': createdAt,
      if (updatedAt != null) 'updatedAt': updatedAt,
    };
  }

  String get initials {
    if (displayName.trim().isEmpty) return '?';
    final parts = displayName.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return displayName.trim().substring(0, 1).toUpperCase();
  }

  String? get fullName {
    if (firstName != null && firstName!.isNotEmpty && lastName != null && lastName!.isNotEmpty) {
      return '$firstName $lastName';
    }
    return null;
  }

  bool get hasAvatar => avatarUrl != null && avatarUrl!.trim().isNotEmpty;

  PersonRecord copyWith({
    String? id,
    String? displayName,
    String? firstName,
    String? lastName,
    String? nickname,
    String? slug,
    String? avatarUrl,
    String? relationshipType,
    List<ImportantDate>? importantDates,
    String? notesMarkdown,
    List<String>? interests,
    SocialLinks? socialLinks,
    String? visibility,
    bool? favorite,
    List<String>? tags,
    String? createdAt,
    String? updatedAt,
  }) {
    return PersonRecord(
      id: id ?? this.id,
      displayName: displayName ?? this.displayName,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      nickname: nickname ?? this.nickname,
      slug: slug ?? this.slug,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      relationshipType: relationshipType ?? this.relationshipType,
      importantDates: importantDates ?? this.importantDates,
      notesMarkdown: notesMarkdown ?? this.notesMarkdown,
      interests: interests ?? this.interests,
      socialLinks: socialLinks ?? this.socialLinks,
      visibility: visibility ?? this.visibility,
      favorite: favorite ?? this.favorite,
      tags: tags ?? this.tags,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
