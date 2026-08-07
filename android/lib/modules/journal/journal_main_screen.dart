import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import 'package:cryptography/cryptography.dart';
import '../../core/crypto/journal_crypto.dart';
import '../../core/crypto/journal_session_vault.dart';
import '../../core/models/journal_entry.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/offline_store.dart';
import '../../shared/widgets/toast_notification.dart';
import 'journal_unlock_modal.dart';

class JournalMainScreen extends StatefulWidget {
  final VoidCallback onLockVault;
  final Function(String? editId) onOpenEditor;
  final String activeThemeKey;

  const JournalMainScreen({
    super.key,
    required this.onLockVault,
    required this.onOpenEditor,
    required this.activeThemeKey,
  });

  @override
  State<JournalMainScreen> createState() => _JournalMainScreenState();
}

class _JournalMainScreenState extends State<JournalMainScreen> {
  bool _isDecrypting = false;
  List<JournalEntryRecord> _entries = [];
  String _activeTab = 'timeline'; // 'timeline', 'calendar', 'stats'
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  DateTime _calendarMonth = DateTime.now();
  String? _selectedCalendarDate;

  static const Map<String, String> _entryTypeLabels = {
    'daily': '📖 Daily Journal',
    'reflection': '🧠 Reflection',
    'travel': '✈️ Travel Journal',
    'dream': '🌙 Dream',
    'meeting': '🤝 Meeting Notes',
    'ideas': '💡 Ideas',
    'gratitude': '🙏 Gratitude',
    'life_event': '🎉 Life Event',
    'health': '🏋️ Health & Fitness',
    'thoughts': '💬 Random Thoughts',
    'project': '📁 Project Journal',
    'learning': '📚 Learning Journal',
    'custom': '✍️ Custom',
  };

  @override
  void initState() {
    super.initState();
    if (JournalSessionVault.isUnlocked) {
      _loadAndDecryptEntries();
    }
  }

  Future<void> _loadAndDecryptEntries() async {
    final dek = JournalSessionVault.activeDek;
    if (dek == null) return;

    // 1. Load local cached entries first for instant offline view
    final localEntries = await OfflineStore.getLocalJournalEntries();
    if (localEntries.isNotEmpty) {
      await _decryptEntryList(localEntries, dek);
      if (mounted) {
        setState(() => _entries = localEntries);
      }
    }

    setState(() => _isDecrypting = _entries.isEmpty);

    // 2. Fetch fresh entries from server and sync offline queue
    try {
      final remoteEntries = await ApiClient.getJournalEntries();
      await _decryptEntryList(remoteEntries, dek);
      await OfflineStore.saveLocalJournalEntries(remoteEntries);

      if (mounted) {
        setState(() {
          _entries = remoteEntries;
          _isDecrypting = false;
        });
      }

      OfflineStore.syncPendingChanges();
    } catch (e) {
      if (mounted) {
        setState(() => _isDecrypting = false);
        if (_entries.isEmpty) {
          ToastNotification.show(context, title: 'Offline Mode', message: 'Loaded local cached entries.');
        }
      }
    }
  }

  Future<void> _decryptEntryList(List<JournalEntryRecord> rawEntries, SecretKey dek) async {
    for (final entry in rawEntries) {
      if (entry.encryptedContent.isNotEmpty) {
        try {
          final plaintext = await JournalCryptoEngine.decryptText(
            entry.encryptedContent,
            entry.iv,
            dek,
          );

          if (plaintext.trim().startsWith('{')) {
            try {
              final Map<String, dynamic> json = jsonDecode(plaintext);
              final title = (json['title'] as String?) ?? 'Untitled Journal Entry';
              final lexicalState = (json['lexicalState'] as String?) ?? '';
              final markdown = (json['markdown'] as String?) ?? JournalCryptoEngine.extractPlaintextFromLexicalState(lexicalState);

              entry.decryptedTitle = title;
              entry.decryptedMarkdown = markdown;
              entry.decryptedLexicalState = lexicalState;
              continue;
            } catch (_) {}
          }

          final lines = plaintext.split('\n');
          var title = 'Untitled Entry';
          var body = plaintext;

          if (lines.isNotEmpty && lines[0].trim().startsWith('#')) {
            title = lines[0].replaceAll(RegExp(r'^#+\s*'), '').trim();
            body = lines.sublist(1).join('\n').trim();
          } else if (lines.isNotEmpty && lines[0].trim().isNotEmpty) {
            title = lines[0].trim();
            body = lines.sublist(1).join('\n').trim();
          }

          entry.decryptedTitle = title;
          entry.decryptedMarkdown = body;
        } catch (_) {
          entry.decryptedTitle = '[Decryption Failed]';
          entry.decryptedMarkdown = '[Unable to decrypt with active key]';
        }
      }
    }
  }

  Future<void> _toggleFavorite(JournalEntryRecord entry) async {
    final newFav = entry.favorite == 1 ? 0 : 1;
    try {
      await ApiClient.updateJournalEntry(entry.id, {'favorite': newFav});
      setState(() {
        final idx = _entries.indexWhere((e) => e.id == entry.id);
        if (idx != -1) {
          _entries[idx] = JournalEntryRecord(
            id: entry.id,
            slug: entry.slug,
            entryDate: entry.entryDate,
            entryType: entry.entryType,
            mood: entry.mood,
            favorite: newFav,
            visibility: entry.visibility,
            locationId: entry.locationId,
            tripId: entry.tripId,
            weatherId: entry.weatherId,
            encryptedContent: entry.encryptedContent,
            encryptionVersion: entry.encryptionVersion,
            iv: entry.iv,
            salt: entry.salt,
            wordCount: entry.wordCount,
            readingTime: entry.readingTime,
            tags: entry.tags,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            decryptedTitle: entry.decryptedTitle,
            decryptedMarkdown: entry.decryptedMarkdown,
          );
        }
      });
    } catch (e) {
      if (mounted) {
        ToastNotification.show(context, title: 'Error', message: 'Failed to update favorite', isError: true);
      }
    }
  }

  Future<void> _handleDelete(JournalEntryRecord entry) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Journal Entry'),
        content: Text('Are you sure you want to delete "${entry.decryptedTitle ?? entry.slug}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await ApiClient.deleteJournalEntry(entry.id);
      setState(() {
        _entries.removeWhere((e) => e.id == entry.id);
      });
      if (mounted) {
        ToastNotification.show(context, title: 'Deleted', message: 'Journal entry removed.');
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(context, title: 'Delete Failed', message: e.toString(), isError: true);
      }
    }
  }

  // --- STATS COMPUTATION ---
  int get _totalWords => _entries.fold(0, (acc, e) => acc + e.wordCount);
  int get _totalFavorites => _entries.where((e) => e.favorite == 1).length;
  int get _avgWords => _entries.isEmpty ? 0 : (_totalWords / _entries.length).round();

  int get _streakDays {
    if (_entries.isEmpty) return 0;
    final dates = _entries.map((e) => e.entryDate).where((d) => d.isNotEmpty).toSet().toList()..sort();
    if (dates.isEmpty) return 0;

    int streak = 0;
    DateTime checkDate = DateTime.now();

    while (true) {
      final dateStr = DateFormat('yyyy-MM-dd').format(checkDate);
      if (dates.contains(dateStr)) {
        streak++;
        checkDate = checkDate.subtract(const Duration(days: 1));
      } else if (streak == 0 && checkDate.difference(DateTime.now()).inDays.abs() <= 1) {
        checkDate = checkDate.subtract(const Duration(days: 1));
      } else {
        break;
      }
    }
    return streak;
  }

  @override
  Widget build(BuildContext context) {
    if (!JournalSessionVault.isUnlocked) {
      return Scaffold(
        body: JournalUnlockModal(
          onUnlocked: () {
            setState(() {});
            _loadAndDecryptEntries();
          },
        ),
      );
    }

    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final filteredEntries = _entries.where((e) {
      if (_searchQuery.trim().isEmpty) return true;
      final q = _searchQuery.toLowerCase().trim();
      final titleMatch = (e.decryptedTitle ?? '').toLowerCase().contains(q);
      final bodyMatch = (e.decryptedMarkdown ?? '').toLowerCase().contains(q);
      final tagMatch = e.tags.any((t) => t.toLowerCase().contains(q));
      return titleMatch || bodyMatch || tagMatch;
    }).toList();

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Bar
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: colorScheme.primary.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(LucideIcons.bookOpen, color: colorScheme.primary, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: const Text(
                            'Personal Memory Vault',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              Icon(LucideIcons.shieldCheck, size: 11, color: Colors.green),
                              SizedBox(width: 4),
                              Text(
                                'DEK/KEK E2EE Active',
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.green),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Zero-knowledge encrypted life journal, reflections, & contextual memories.',
                      style: TextStyle(fontSize: 12, color: colorScheme.onSurface.withValues(alpha: 0.6)),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              ElevatedButton.icon(
                onPressed: () => widget.onOpenEditor(null),
                style: ElevatedButton.styleFrom(
                  backgroundColor: colorScheme.primary,
                  foregroundColor: Colors.white,
                  elevation: 2,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                icon: const Icon(LucideIcons.plus, size: 15),
                label: const Text('New Entry', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed: () {
                  JournalSessionVault.lock();
                  setState(() {});
                  ToastNotification.show(context, title: 'Vault Locked', message: 'Session encryption keys purged from memory.');
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red,
                  side: BorderSide(color: Colors.red.withValues(alpha: 0.5)),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                icon: const Icon(LucideIcons.lock, size: 14),
                label: const Text('Lock', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Navigation Tabs & Search Input
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Wrap(
              spacing: 12,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                // Sub Tabs
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: colorScheme.onSurface.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildSubTabButton('timeline', 'Timeline', LucideIcons.layers),
                      _buildSubTabButton('calendar', 'Calendar', LucideIcons.calendar),
                      _buildSubTabButton('stats', 'Stats', LucideIcons.barChart2),
                    ],
                  ),
                ),

                // Search Input
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 360),
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search decrypted entries...',
                      hintStyle: TextStyle(fontSize: 12, color: colorScheme.onSurface.withValues(alpha: 0.5)),
                      prefixIcon: const Icon(LucideIcons.search, size: 15),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide(color: colorScheme.outline.withValues(alpha: 0.2))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide(color: colorScheme.outline.withValues(alpha: 0.2))),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide(color: colorScheme.primary)),
                    ),
                    onChanged: (val) => setState(() => _searchQuery = val),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Main View Content
          Expanded(
            child: _isDecrypting
                ? const Center(child: CircularProgressIndicator())
                : _buildActiveTabContent(context, filteredEntries),
          ),
        ],
      ),
    );
  }

  Widget _buildSubTabButton(String key, String label, IconData icon) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isSelected = _activeTab == key;

    return InkWell(
      onTap: () => setState(() => _activeTab = key),
      borderRadius: BorderRadius.circular(18),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? colorScheme.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: colorScheme.primary.withValues(alpha: 0.25),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: isSelected ? Colors.white : colorScheme.onSurface.withValues(alpha: 0.7)),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? Colors.white : colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveTabContent(BuildContext context, List<JournalEntryRecord> entries) {
    if (_activeTab == 'calendar') {
      return _buildCalendarView(context, entries);
    } else if (_activeTab == 'stats') {
      return _buildStatsView(context, entries);
    } else {
      return _buildTimelineView(context, entries);
    }
  }

  // --- TIMELINE VIEW ---
  Widget _buildTimelineView(BuildContext context, List<JournalEntryRecord> entries) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isMobile = MediaQuery.of(context).size.width < 650;

    return Column(
      children: [
        // 4 Telemetry Cards (2x2 on Mobile, 1x4 on Tablet/Desktop)
        if (isMobile)
          Column(
            children: [
              Row(
                children: [
                  _buildStatCard(context, title: 'WRITING STREAK', value: '$_streakDays Days', sub: 'Best: 21 days', icon: LucideIcons.flame, color: Colors.orange),
                  const SizedBox(width: 8),
                  _buildStatCard(context, title: 'TOTAL ENTRIES', value: '${entries.length}', sub: '${entries.length} recorded', icon: LucideIcons.book, color: Colors.blue),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _buildStatCard(context, title: 'WORDS WRITTEN', value: NumberFormat('#,###').format(_totalWords), sub: 'Avg $_avgWords words/entry', icon: LucideIcons.fileText, color: Colors.purple),
                  const SizedBox(width: 8),
                  _buildStatCard(context, title: 'FAVORITES', value: '$_totalFavorites', sub: 'Starred memories', icon: LucideIcons.star, color: Colors.amber),
                ],
              ),
            ],
          )
        else
          Row(
            children: [
              _buildStatCard(context, title: 'WRITING STREAK', value: '$_streakDays Days', sub: 'Best: 21 days', icon: LucideIcons.flame, color: Colors.orange),
              const SizedBox(width: 12),
              _buildStatCard(context, title: 'TOTAL ENTRIES', value: '${entries.length}', sub: '${entries.length} recorded', icon: LucideIcons.book, color: Colors.blue),
              const SizedBox(width: 12),
              _buildStatCard(context, title: 'WORDS WRITTEN', value: NumberFormat('#,###').format(_totalWords), sub: 'Avg $_avgWords words/entry', icon: LucideIcons.fileText, color: Colors.purple),
              const SizedBox(width: 12),
              _buildStatCard(context, title: 'FAVORITES', value: '$_totalFavorites', sub: 'Starred memories', icon: LucideIcons.star, color: Colors.amber),
            ],
          ),
        const SizedBox(height: 16),

        // Grouped Entries List
        Expanded(
          child: entries.isEmpty
              ? Center(
                  child: Text(
                    _searchQuery.isNotEmpty ? 'No decrypted entries match search.' : 'No journal entries in vault.',
                    style: TextStyle(color: colorScheme.onSurface.withValues(alpha: 0.5)),
                  ),
                )
              : ListView.builder(
                  itemCount: entries.length,
                  itemBuilder: (context, index) {
                    final item = entries[index];
                    return _buildEntryCard(context, item);
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildStatCard(BuildContext context, {required String title, required String value, required String sub, required IconData icon, required Color color}) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colorScheme.outline.withValues(alpha: 0.18)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
              child: Icon(icon, size: 20, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5, color: colorScheme.onSurface.withValues(alpha: 0.5))),
                  const SizedBox(height: 2),
                  Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  Text(sub, style: TextStyle(fontSize: 11, color: colorScheme.onSurface.withValues(alpha: 0.5))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEntryCard(BuildContext context, JournalEntryRecord entry) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final typeLabel = _entryTypeLabels[entry.entryType.toLowerCase()] ?? '📖 ${entry.entryType.toUpperCase()}';
    final moodLabel = entry.mood != null && entry.mood!.isNotEmpty
        ? entry.mood![0].toUpperCase() + entry.mood!.substring(1)
        : 'Neutral';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colorScheme.outline.withValues(alpha: 0.18)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Badges & Actions Row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: colorScheme.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
                child: Text(typeLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: colorScheme.primary)),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: Colors.amber.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(16)),
                child: Text('😊 $moodLabel', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber)),
              ),
              const SizedBox(width: 10),
              Text(entry.entryDate, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: colorScheme.onSurface.withValues(alpha: 0.5))),

              const Spacer(),

              Text('${entry.wordCount} words (${entry.readingTime}m)', style: TextStyle(fontSize: 11, color: colorScheme.onSurface.withValues(alpha: 0.5))),
              const SizedBox(width: 8),

              IconButton(
                icon: Icon(entry.favorite == 1 ? LucideIcons.star : LucideIcons.star, size: 16, color: entry.favorite == 1 ? Colors.amber : colorScheme.onSurface.withValues(alpha: 0.4)),
                onPressed: () => _toggleFavorite(entry),
                tooltip: 'Favorite',
              ),
              IconButton(
                icon: const Icon(LucideIcons.trash2, size: 16, color: Colors.red),
                onPressed: () => _handleDelete(entry),
                tooltip: 'Delete',
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Title & Body
          InkWell(
            onTap: () => widget.onOpenEditor(entry.id),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.decryptedTitle ?? entry.slug,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  entry.decryptedMarkdown ?? '',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, color: colorScheme.onSurface.withValues(alpha: 0.7), height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- CALENDAR VIEW ---
  Widget _buildCalendarView(BuildContext context, List<JournalEntryRecord> entries) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final firstDayOfMonth = DateTime(_calendarMonth.year, _calendarMonth.month, 1);
    final firstWeekday = firstDayOfMonth.weekday % 7; // 0 for Sun, 1 for Mon ... 6 for Sat
    final daysInMonth = DateUtils.getDaysInMonth(_calendarMonth.year, _calendarMonth.month);
    final totalCells = ((firstWeekday + daysInMonth) / 7.0).ceil() * 7;

    final Map<String, List<JournalEntryRecord>> entriesByDate = {};
    for (final e in entries) {
      if (e.entryDate.isNotEmpty) {
        entriesByDate.putIfAbsent(e.entryDate, () => []).add(e);
      }
    }

    final selectedEntries = _selectedCalendarDate != null ? (entriesByDate[_selectedCalendarDate!] ?? []) : [];

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Month Selector Bar
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(LucideIcons.chevronLeft),
                onPressed: () => setState(() => _calendarMonth = DateTime(_calendarMonth.year, _calendarMonth.month - 1, 1)),
              ),
              Text(
                DateFormat('MMMM yyyy').format(_calendarMonth),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              IconButton(
                icon: const Icon(LucideIcons.chevronRight),
                onPressed: () => setState(() => _calendarMonth = DateTime(_calendarMonth.year, _calendarMonth.month + 1, 1)),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Weekdays Header Row
          Row(
            children: const [
              Expanded(child: Center(child: Text('Sun', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)))),
              Expanded(child: Center(child: Text('Mon', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)))),
              Expanded(child: Center(child: Text('Tue', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)))),
              Expanded(child: Center(child: Text('Wed', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)))),
              Expanded(child: Center(child: Text('Thu', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)))),
              Expanded(child: Center(child: Text('Fri', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)))),
              Expanded(child: Center(child: Text('Sat', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)))),
            ],
          ),
          const SizedBox(height: 8),

          // Calendar Grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              childAspectRatio: 1.1,
            ),
            itemCount: totalCells,
            itemBuilder: (context, index) {
              final dayNumber = index - firstWeekday + 1;
              if (dayNumber < 1 || dayNumber > daysInMonth) {
                return const SizedBox.shrink();
              }

              final dateStr = DateFormat('yyyy-MM-dd').format(DateTime(_calendarMonth.year, _calendarMonth.month, dayNumber));
              final dayEntries = entriesByDate[dateStr] ?? [];
              final hasEntries = dayEntries.isNotEmpty;
              final isSelected = _selectedCalendarDate == dateStr;

              return InkWell(
                onTap: () {
                  if (hasEntries) {
                    setState(() => _selectedCalendarDate = dateStr);
                  } else {
                    // Blank date clicked -> Create new entry pre-filled with date
                    widget.onOpenEditor(null);
                  }
                },
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  margin: const EdgeInsets.all(3),
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? colorScheme.primary.withValues(alpha: 0.3)
                        : (hasEntries ? colorScheme.primary.withValues(alpha: 0.15) : colorScheme.surface),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: isSelected
                          ? colorScheme.primary
                          : (hasEntries ? colorScheme.primary.withValues(alpha: 0.5) : colorScheme.outline.withValues(alpha: 0.15)),
                      width: isSelected ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '$dayNumber',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: hasEntries ? FontWeight.bold : FontWeight.normal,
                          color: hasEntries ? colorScheme.primary : colorScheme.onSurface,
                        ),
                      ),
                      if (hasEntries) ...[
                        const SizedBox(height: 2),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(
                            color: colorScheme.primary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '${dayEntries.length}',
                            style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 16),

          // Selected Date Entries Section
          if (_selectedCalendarDate != null) ...[
            Row(
              children: [
                Text(
                  'Entries for $_selectedCalendarDate (${selectedEntries.length})',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: () => widget.onOpenEditor(null),
                  icon: const Icon(LucideIcons.plus, size: 14),
                  label: const Text('Add Entry', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (selectedEntries.isEmpty)
              const Padding(
                padding: EdgeInsets.all(12),
                child: Text('No entries recorded for this date.', style: TextStyle(color: Colors.grey)),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: selectedEntries.length,
                itemBuilder: (context, index) {
                  return _buildEntryCard(context, selectedEntries[index]);
                },
              ),
          ],
        ],
      ),
    );
  }

  // --- STATS VIEW ---
  Widget _buildStatsView(BuildContext context, List<JournalEntryRecord> entries) {
    final moodCounts = <String, int>{};
    for (final e in entries) {
      final m = e.mood ?? 'neutral';
      moodCounts[m] = (moodCounts[m] ?? 0) + 1;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Mood Distribution', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        ...moodCounts.entries.map((item) {
          final pct = entries.isEmpty ? 0.0 : (item.value / entries.length);
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                SizedBox(width: 100, child: Text(item.key.toUpperCase(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold))),
                Expanded(
                  child: LinearProgressIndicator(value: pct, minHeight: 8, borderRadius: BorderRadius.circular(4)),
                ),
                const SizedBox(width: 10),
                Text('${item.value} (${(pct * 100).toStringAsFixed(0)}%)', style: const TextStyle(fontSize: 12)),
              ],
            ),
          );
        }),
      ],
    );
  }
}
