import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/journal_entry.dart';
import '../models/microblog.dart';
import '../network/api_client.dart';

class OfflineStore {
  static const String _keyJournalEntries = 'offline_journal_entries';
  static const String _keyPendingJournalSaves = 'pending_journal_saves';
  static const String _keyPendingJournalDeletes = 'pending_journal_deletes';

  static const String _keyMicroblogs = 'offline_microblogs';
  static const String _keyPendingMicroblogSaves = 'pending_microblog_saves';
  static const String _keyPendingMicroblogDeletes = 'pending_microblog_deletes';

  // --- JOURNAL ENTRIES ---

  static Future<List<JournalEntryRecord>> getLocalJournalEntries() async {
    final prefs = await SharedPreferences.getInstance();
    final rawJson = prefs.getString(_keyJournalEntries);
    if (rawJson == null || rawJson.isEmpty) return [];

    try {
      final List<dynamic> decoded = jsonDecode(rawJson);
      return decoded.map((e) => JournalEntryRecord.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> saveLocalJournalEntries(List<JournalEntryRecord> entries) async {
    final prefs = await SharedPreferences.getInstance();
    final rawJson = jsonEncode(entries.map((e) => e.toJson()).toList());
    await prefs.setString(_keyJournalEntries, rawJson);
  }

  static Future<void> saveJournalEntryLocally(JournalEntryRecord entry, {bool isPendingSync = true}) async {
    final entries = await getLocalJournalEntries();
    final index = entries.indexWhere((e) => e.id == entry.id);
    if (index >= 0) {
      entries[index] = entry;
    } else {
      entries.insert(0, entry);
    }
    await saveLocalJournalEntries(entries);

    if (isPendingSync) {
      await _addPendingJournalSave(entry.id);
    }
  }

  static Future<void> deleteJournalEntryLocally(String id) async {
    final entries = await getLocalJournalEntries();
    entries.removeWhere((e) => e.id == id);
    await saveLocalJournalEntries(entries);

    await _removePendingJournalSave(id);
    await _addPendingJournalDelete(id);
  }

  // --- PENDING JOURNAL QUEUE ---

  static Future<Set<String>> getPendingJournalSaves() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_keyPendingJournalSaves) ?? [];
    return list.toSet();
  }

  static Future<void> _addPendingJournalSave(String id) async {
    final saves = await getPendingJournalSaves();
    saves.add(id);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_keyPendingJournalSaves, saves.toList());
  }

  static Future<void> _removePendingJournalSave(String id) async {
    final saves = await getPendingJournalSaves();
    saves.remove(id);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_keyPendingJournalSaves, saves.toList());
  }

  static Future<Set<String>> getPendingJournalDeletes() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_keyPendingJournalDeletes) ?? [];
    return list.toSet();
  }

  static Future<void> _addPendingJournalDelete(String id) async {
    final deletes = await getPendingJournalDeletes();
    deletes.add(id);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_keyPendingJournalDeletes, deletes.toList());
  }

  static Future<void> _removePendingJournalDelete(String id) async {
    final deletes = await getPendingJournalDeletes();
    deletes.remove(id);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_keyPendingJournalDeletes, deletes.toList());
  }

  // --- MICROBLOGS ---

  static Future<List<Microblog>> getLocalMicroblogs() async {
    final prefs = await SharedPreferences.getInstance();
    final rawJson = prefs.getString(_keyMicroblogs);
    if (rawJson == null || rawJson.isEmpty) return [];

    try {
      final List<dynamic> decoded = jsonDecode(rawJson);
      return decoded.map((e) => Microblog.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> saveLocalMicroblogs(List<Microblog> items) async {
    final prefs = await SharedPreferences.getInstance();
    final rawJson = jsonEncode(items.map((e) => e.toJson()).toList());
    await prefs.setString(_keyMicroblogs, rawJson);
  }

  static Future<void> saveMicroblogLocally(Microblog item, {bool isPendingSync = true}) async {
    final items = await getLocalMicroblogs();
    final index = items.indexWhere((e) => e.id == item.id);
    if (index >= 0) {
      items[index] = item;
    } else {
      items.insert(0, item);
    }
    await saveLocalMicroblogs(items);

    if (isPendingSync) {
      await _addPendingMicroblogSave(item.id);
    }
  }

  static Future<void> deleteMicroblogLocally(String id) async {
    final items = await getLocalMicroblogs();
    items.removeWhere((e) => e.id == id);
    await saveLocalMicroblogs(items);

    await _removePendingMicroblogSave(id);
    await _addPendingMicroblogDelete(id);
  }

  // --- PENDING MICROBLOG QUEUE ---

  static Future<Set<String>> getPendingMicroblogSaves() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_keyPendingMicroblogSaves) ?? [];
    return list.toSet();
  }

  static Future<void> _addPendingMicroblogSave(String id) async {
    final saves = await getPendingMicroblogSaves();
    saves.add(id);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_keyPendingMicroblogSaves, saves.toList());
  }

  static Future<void> _removePendingMicroblogSave(String id) async {
    final saves = await getPendingMicroblogSaves();
    saves.remove(id);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_keyPendingMicroblogSaves, saves.toList());
  }

  static Future<Set<String>> getPendingMicroblogDeletes() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_keyPendingMicroblogDeletes) ?? [];
    return list.toSet();
  }

  static Future<void> _addPendingMicroblogDelete(String id) async {
    final deletes = await getPendingMicroblogDeletes();
    deletes.add(id);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_keyPendingMicroblogDeletes, deletes.toList());
  }

  static Future<void> _removePendingMicroblogDelete(String id) async {
    final deletes = await getPendingMicroblogDeletes();
    deletes.remove(id);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_keyPendingMicroblogDeletes, deletes.toList());
  }

  // --- UNSAVED / PENDING COUNT ---

  static Future<int> getUnsavedCount() async {
    final jSaves = await getPendingJournalSaves();
    final jDeletes = await getPendingJournalDeletes();
    final mSaves = await getPendingMicroblogSaves();
    final mDeletes = await getPendingMicroblogDeletes();
    return jSaves.length + jDeletes.length + mSaves.length + mDeletes.length;
  }

  // --- SYNC ALL PENDING ---

  static Future<bool> syncPendingChanges() async {
    bool allSynced = true;

    // 1. Sync Journal Deletes
    final jDeletes = await getPendingJournalDeletes();
    for (final id in jDeletes) {
      try {
        await ApiClient.deleteJournalEntry(id);
        await _removePendingJournalDelete(id);
      } catch (_) {
        allSynced = false;
      }
    }

    // 2. Sync Journal Saves
    final jSaves = await getPendingJournalSaves();
    final localJournal = await getLocalJournalEntries();
    for (final id in jSaves) {
      final entry = localJournal.firstWhere((e) => e.id == id, orElse: () => throw Exception('Not found'));
      try {
        final payload = {
          'entryDate': entry.entryDate,
          'entryType': entry.entryType,
          'mood': entry.mood,
          'locationId': entry.locationId,
          'tripId': entry.tripId,
          'encryptedContent': entry.encryptedContent,
          'iv': entry.iv,
          'salt': entry.salt,
          'wordCount': entry.wordCount,
          'readingTime': entry.readingTime,
        };

        if (id.startsWith('temp_')) {
          final created = await ApiClient.createJournalEntry(payload);
          await deleteJournalEntryLocally(id);
          await saveJournalEntryLocally(created, isPendingSync: false);
        } else {
          await ApiClient.updateJournalEntry(id, payload);
        }
        await _removePendingJournalSave(id);
      } catch (_) {
        allSynced = false;
      }
    }

    // 3. Sync Microblog Deletes
    final mDeletes = await getPendingMicroblogDeletes();
    for (final id in mDeletes) {
      try {
        await ApiClient.deleteMicroblog(id);
        await _removePendingMicroblogDelete(id);
      } catch (_) {
        allSynced = false;
      }
    }

    // 4. Sync Microblog Saves
    final mSaves = await getPendingMicroblogSaves();
    final localMicroblogs = await getLocalMicroblogs();
    for (final id in mSaves) {
      final item = localMicroblogs.firstWhere((e) => e.id == id, orElse: () => throw Exception('Not found'));
      try {
        final payload = {
          if (!id.startsWith('temp_')) 'id': id,
          'slug': item.slug,
          'contentMarkdown': item.contentMarkdown,
          'status': item.status,
          'publishedAt': item.publishedAt,
          'locationId': item.locationId,
          'tripId': item.tripId,
          'tags': item.tags,
          'images': item.images,
        };

        final saved = await ApiClient.saveMicroblog(payload);
        if (id.startsWith('temp_')) {
          await deleteMicroblogLocally(id);
        }
        await saveMicroblogLocally(Microblog.fromJson(saved), isPendingSync: false);
        await _removePendingMicroblogSave(id);
      } catch (_) {
        allSynced = false;
      }
    }

    return allSynced;
  }
}
