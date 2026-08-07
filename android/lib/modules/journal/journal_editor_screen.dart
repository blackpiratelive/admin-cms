import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/crypto/journal_crypto.dart';
import '../../core/crypto/journal_session_vault.dart';
import '../../core/network/api_client.dart';
import '../../shared/widgets/toast_notification.dart';

class JournalEditorScreen extends StatefulWidget {
  final String? editId;
  final String activeThemeKey;
  final VoidCallback onBackToList;

  const JournalEditorScreen({
    super.key,
    this.editId,
    required this.activeThemeKey,
    required this.onBackToList,
  });

  @override
  State<JournalEditorScreen> createState() => _JournalEditorScreenState();
}

class _JournalEditorScreenState extends State<JournalEditorScreen> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _contentController = TextEditingController();

  DateTime _entryDate = DateTime.now();
  String _entryType = 'daily';
  String _mood = 'good';
  String? _selectedLocationId;
  String? _selectedTripId;
  String? _selectedPersonId;

  List<dynamic> _locations = [];
  List<dynamic> _trips = [];
  List<dynamic> _people = [];

  Map<String, dynamic> _contextData = {
    'moviesCount': 0,
    'scrobblesCount': 0,
    'photosCount': 0,
  };

  bool _isLoading = true;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _initData();
  }

  Future<void> _initData() async {
    try {
      final pickers = await ApiClient.getJournalPickersData();
      _locations = pickers['locations'] ?? [];
      _trips = pickers['trips'] ?? [];
      _people = pickers['people'] ?? [];

      if (widget.editId != null) {
        final entries = await ApiClient.getJournalEntries();
        final match = entries.firstWhere((e) => e.id == widget.editId, orElse: () => throw Exception('Entry not found'));

        final dek = JournalSessionVault.activeDek;
        if (dek != null && match.encryptedContent.isNotEmpty) {
          final plaintext = await JournalCryptoEngine.decryptText(match.encryptedContent, match.iv, dek);
          final lines = plaintext.split('\n');
          if (lines.isNotEmpty && lines[0].trim().startsWith('#')) {
            _titleController.text = lines[0].replaceAll(RegExp(r'^#+\s*'), '').trim();
            _contentController.text = lines.sublist(1).join('\n').trim();
          } else {
            _titleController.text = lines.first;
            _contentController.text = lines.sublist(1).join('\n').trim();
          }
        }

        if (match.entryDate.isNotEmpty) {
          try {
            _entryDate = DateFormat('yyyy-MM-DD').parse(match.entryDate);
          } catch (_) {}
        }
        _entryType = match.entryType;
        _mood = match.mood ?? 'good';
        _selectedLocationId = match.locationId;
        _selectedTripId = match.tripId;
      }

      await _fetchContextData();

      setState(() => _isLoading = false);
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ToastNotification.show(context, title: 'Error', message: 'Failed to load journal entry', isError: true);
      }
    }
  }

  Future<void> _fetchContextData() async {
    final dateStr = DateFormat('yyyy-MM-dd').format(_entryDate);
    final ctx = await ApiClient.getJournalContextData(dateStr);
    setState(() => _contextData = ctx);
  }

  Future<void> _handleSave() async {
    final dek = JournalSessionVault.activeDek;
    if (dek == null) {
      ToastNotification.show(context, title: 'Vault Locked', message: 'Please unlock vault first.', isError: true);
      return;
    }

    final title = _titleController.text.trim();
    final body = _contentController.text;

    if (title.isEmpty && body.trim().isEmpty) {
      ToastNotification.show(context, title: 'Validation Error', message: 'Entry title or body cannot be empty.', isError: true);
      return;
    }

    setState(() => _isSaving = true);

    try {
      final plaintext = '# $title\n\n$body';
      final encrypted = await JournalCryptoEngine.encryptText(plaintext, dek);

      final dateStr = DateFormat('yyyy-MM-dd').format(_entryDate);
      final wordCount = body.trim().isEmpty ? 0 : body.trim().split(RegExp(r'\s+')).length;
      final readingTime = (wordCount / 200).ceil();

      final payload = {
        'entryDate': dateStr,
        'entryType': _entryType,
        'mood': _mood,
        'locationId': _selectedLocationId,
        'tripId': _selectedTripId,
        'encryptedContent': encrypted['ciphertext'],
        'iv': encrypted['iv'],
        'salt': JournalCryptoEngine.generateSalt(),
        'wordCount': wordCount,
        'readingTime': readingTime,
      };

      if (widget.editId != null) {
        await ApiClient.updateJournalEntry(widget.editId!, payload);
      } else {
        await ApiClient.createJournalEntry(payload);
      }

      if (mounted) {
        ToastNotification.show(context, title: 'Saved', message: 'Journal entry saved securely.');
        widget.onBackToList();
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(context, title: 'Save Failed', message: e.toString(), isError: true);
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _pickAndInsertImage() async {
    try {
      final picker = ImagePicker();
      final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (file == null) return;

      final bytes = await file.readAsBytes();
      final url = await ApiClient.uploadImage(file.path, file.name, bytes);
      setState(() {
        _contentController.text += '\n![Image]($url)\n';
      });
      if (mounted) {
        ToastNotification.show(context, title: 'Uploaded', message: 'Image inserted into entry.');
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(context, title: 'Upload Failed', message: e.toString(), isError: true);
      }
    }
  }

  void _insertTemplate(String template) {
    if (template == 'daily') {
      _contentController.text += '\n\n### Daily Reflection\n- **Highlights**: \n- **Challenges**: \n- **Gratitude**: \n';
    } else if (template == 'weekly') {
      _contentController.text += '\n\n### Weekly Review\n- **Wins**: \n- **Key Learnings**: \n- **Goals for Next Week**: \n';
    } else if (template == 'gratitude') {
      _contentController.text += '\n\n### Gratitude Journal\n1. \n2. \n3. \n';
    }
  }

  int get _wordCount => _contentController.text.trim().isEmpty ? 0 : _contentController.text.trim().split(RegExp(r'\s+')).length;
  int get _charCount => _contentController.text.length;
  int get _readTime => (_wordCount / 200).ceil();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Action Header
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: widget.onBackToList,
                icon: const Icon(LucideIcons.arrowLeft, size: 14),
                label: const Text('Back to Vault', style: TextStyle(fontSize: 12)),
              ),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: _isSaving ? null : _handleSave,
                style: ElevatedButton.styleFrom(
                  backgroundColor: colorScheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                icon: _isSaving
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(LucideIcons.save, size: 14),
                label: const Text('Save Entry', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Metadata Form Controls Bar
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: colorScheme.surface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
            ),
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                // Date Picker
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _entryDate,
                      firstDate: DateTime(2000),
                      lastDate: DateTime(2100),
                    );
                    if (picked != null) {
                      setState(() => _entryDate = picked);
                      _fetchContextData();
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(border: Border.all(color: colorScheme.outline.withValues(alpha: 0.3)), borderRadius: BorderRadius.circular(6)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(LucideIcons.calendar, size: 14),
                        const SizedBox(width: 8),
                        Text(DateFormat('MM / dd / yyyy').format(_entryDate), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),

                // Entry Type
                DropdownButton<String>(
                  value: _entryType,
                  isDense: true,
                  style: TextStyle(fontSize: 12, color: colorScheme.onSurface),
                  items: const [
                    DropdownMenuItem(value: 'daily', child: Text('📖 Daily Journal')),
                    DropdownMenuItem(value: 'travel', child: Text('✈️ Travel Journal')),
                    DropdownMenuItem(value: 'reflection', child: Text('🧠 Reflection')),
                    DropdownMenuItem(value: 'idea', child: Text('💡 Idea')),
                    DropdownMenuItem(value: 'note', child: Text('📝 Note')),
                  ],
                  onChanged: (val) => setState(() => _entryType = val ?? 'daily'),
                ),

                // Mood Dropdown
                DropdownButton<String>(
                  value: _mood,
                  isDense: true,
                  style: TextStyle(fontSize: 12, color: colorScheme.onSurface),
                  items: const [
                    DropdownMenuItem(value: 'good', child: Text('😊 Good')),
                    DropdownMenuItem(value: 'neutral', child: Text('😐 Neutral')),
                    DropdownMenuItem(value: 'sad', child: Text('😔 Sad')),
                    DropdownMenuItem(value: 'excited', child: Text('🤩 Excited')),
                    DropdownMenuItem(value: 'frustrated', child: Text('😤 Frustrated')),
                  ],
                  onChanged: (val) => setState(() => _mood = val ?? 'good'),
                ),

                // Template Inserter
                DropdownButton<String>(
                  hint: const Text('-- Select Template --', style: TextStyle(fontSize: 12)),
                  isDense: true,
                  style: TextStyle(fontSize: 12, color: colorScheme.onSurface),
                  items: const [
                    DropdownMenuItem(value: 'daily', child: Text('Daily Reflection')),
                    DropdownMenuItem(value: 'weekly', child: Text('Weekly Review')),
                    DropdownMenuItem(value: 'gratitude', child: Text('Gratitude Log')),
                  ],
                  onChanged: (val) {
                    if (val != null) _insertTemplate(val);
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Main Editor Body + Context Sidebar
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Left: Editor
                Expanded(
                  flex: 3,
                  child: Column(
                    children: [
                      // Title Input Box
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: colorScheme.surface,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
                        ),
                        child: TextField(
                          controller: _titleController,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          decoration: const InputDecoration(
                            hintText: 'Title of your journal entry...',
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Textarea & Formatting Bar
                      Expanded(
                        child: Container(
                          decoration: BoxDecoration(
                            color: colorScheme.surface,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
                          ),
                          child: Column(
                            children: [
                              // Formatting Toolbar & Telemetry Bar
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: colorScheme.onSurface.withValues(alpha: 0.03),
                                  border: Border(bottom: BorderSide(color: colorScheme.outline.withValues(alpha: 0.15))),
                                ),
                                child: Row(
                                  children: [
                                    IconButton(
                                      icon: const Icon(LucideIcons.bold, size: 14),
                                      onPressed: () => setState(() => _contentController.text += '**bold text**'),
                                      tooltip: 'Bold',
                                    ),
                                    IconButton(
                                      icon: const Icon(LucideIcons.italic, size: 14),
                                      onPressed: () => setState(() => _contentController.text += '*italic text*'),
                                      tooltip: 'Italic',
                                    ),
                                    IconButton(
                                      icon: const Icon(LucideIcons.heading1, size: 14),
                                      onPressed: () => setState(() => _contentController.text += '\n# Heading 1\n'),
                                      tooltip: 'H1',
                                    ),
                                    IconButton(
                                      icon: const Icon(LucideIcons.heading2, size: 14),
                                      onPressed: () => setState(() => _contentController.text += '\n## Heading 2\n'),
                                      tooltip: 'H2',
                                    ),
                                    IconButton(
                                      icon: const Icon(LucideIcons.list, size: 14),
                                      onPressed: () => setState(() => _contentController.text += '\n- List item\n'),
                                      tooltip: 'Bullet List',
                                    ),
                                    IconButton(
                                      icon: const Icon(LucideIcons.image, size: 14),
                                      onPressed: _pickAndInsertImage,
                                      tooltip: 'Insert Image',
                                    ),
                                    const Spacer(),
                                    Text(
                                      '$_wordCount words  $_charCount chars  $_readTime min read',
                                      style: TextStyle(fontSize: 11, fontFamily: 'monospace', color: colorScheme.onSurface.withValues(alpha: 0.6)),
                                    ),
                                  ],
                                ),
                              ),

                              // Text Field
                              Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: TextField(
                                    controller: _contentController,
                                    maxLines: null,
                                    expands: true,
                                    style: const TextStyle(fontSize: 14, height: 1.5),
                                    decoration: const InputDecoration(
                                      hintText: 'Write your journal entry... Type \'/\' for commands or \'@\' to mention entities.',
                                      border: InputBorder.none,
                                      enabledBorder: InputBorder.none,
                                      focusedBorder: InputBorder.none,
                                    ),
                                    onChanged: (_) => setState(() {}),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),

                // Right Sidebar: Context & Connections
                Expanded(
                  flex: 1,
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: colorScheme.surface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Context & Connections',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        const Divider(height: 16),

                        // Location Picker
                        Row(
                          children: const [
                            Icon(LucideIcons.mapPin, size: 13, color: Colors.orange),
                            SizedBox(width: 6),
                            Text('Location', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        DropdownButtonFormField<String?>(
                          initialValue: _selectedLocationId,
                          isDense: true,
                          style: TextStyle(fontSize: 12, color: colorScheme.onSurface),
                          items: [
                            const DropdownMenuItem(value: null, child: Text('No location linked')),
                            ..._locations.map((loc) => DropdownMenuItem(
                                  value: loc['id'] as String,
                                  child: Text(loc['name'] as String, overflow: TextOverflow.ellipsis),
                                )),
                          ],
                          onChanged: (val) => setState(() => _selectedLocationId = val),
                        ),
                        const SizedBox(height: 12),

                        // Trip Picker
                        Row(
                          children: const [
                            Icon(LucideIcons.navigation, size: 13, color: Colors.orange),
                            SizedBox(width: 6),
                            Text('Trip', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        DropdownButtonFormField<String?>(
                          initialValue: _selectedTripId,
                          isDense: true,
                          style: TextStyle(fontSize: 12, color: colorScheme.onSurface),
                          items: [
                            const DropdownMenuItem(value: null, child: Text('No trip linked')),
                            ..._trips.map((trip) => DropdownMenuItem(
                                  value: trip['id'] as String,
                                  child: Text(trip['title'] as String, overflow: TextOverflow.ellipsis),
                                )),
                          ],
                          onChanged: (val) => setState(() => _selectedTripId = val),
                        ),
                        const SizedBox(height: 12),

                        // People Present Picker
                        Row(
                          children: const [
                            Icon(LucideIcons.users, size: 13, color: Colors.orange),
                            SizedBox(width: 6),
                            Text('People Present', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        DropdownButtonFormField<String?>(
                          initialValue: _selectedPersonId,
                          isDense: true,
                          style: TextStyle(fontSize: 12, color: colorScheme.onSurface),
                          items: [
                            const DropdownMenuItem(value: null, child: Text('+ Tag Person')),
                            ..._people.map((person) => DropdownMenuItem(
                                  value: person['id'] as String,
                                  child: Text(person['displayName'] as String, overflow: TextOverflow.ellipsis),
                                )),
                          ],
                          onChanged: (val) => setState(() => _selectedPersonId = val),
                        ),
                        const SizedBox(height: 16),

                        // On This Day Box
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: colorScheme.onSurface.withValues(alpha: 0.04),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: colorScheme.outline.withValues(alpha: 0.15)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'ON THIS DAY (${DateFormat('yyyy-MM-dd').format(_entryDate)})',
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: colorScheme.onSurface.withValues(alpha: 0.6)),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(LucideIcons.film, size: 12),
                                  const SizedBox(width: 6),
                                  Text('Movies Watched (${_contextData['moviesCount'] ?? 0})', style: const TextStyle(fontSize: 11)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(LucideIcons.music, size: 12),
                                  const SizedBox(width: 6),
                                  Text('Music Listen Count (${_contextData['scrobblesCount'] ?? 0})', style: const TextStyle(fontSize: 11)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(LucideIcons.camera, size: 12),
                                  const SizedBox(width: 6),
                                  Text('Photos Captured (${_contextData['photosCount'] ?? 0})', style: const TextStyle(fontSize: 11)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
