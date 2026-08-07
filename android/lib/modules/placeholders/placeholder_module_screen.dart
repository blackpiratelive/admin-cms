import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../shared/widgets/toast_notification.dart';

class PlaceholderModuleScreen extends StatelessWidget {
  final String moduleKey;

  const PlaceholderModuleScreen({super.key, required this.moduleKey});

  Map<String, dynamic> _getModuleInfo() {
    switch (moduleKey) {
      case 'dashboard':
        return {'title': 'Dashboard', 'subtitle': 'Control center overview & analytics widgets', 'icon': LucideIcons.layoutDashboard};
      case 'analytics':
        return {'title': 'Analytics & Memory', 'subtitle': 'Memory Discovery Engine & Timeline scoring', 'icon': LucideIcons.barChart2};
      case 'journal':
        return {'title': 'Encrypted Journal', 'subtitle': 'E2EE Personal Journal & Lexical Editor', 'icon': LucideIcons.bookOpen};
      case 'blog':
        return {'title': 'Long-Form Blog', 'subtitle': 'Multi-chapter blog posts & publishing', 'icon': LucideIcons.fileText};
      case 'notes':
        return {'title': 'Notes', 'subtitle': 'Quick markdown notes & knowledge graph', 'icon': LucideIcons.stickyNote};
      case 'pages':
        return {'title': 'Pages', 'subtitle': 'Hugo static site pages builder', 'icon': LucideIcons.file};
      case 'todos':
        return {'title': 'Todos & Projects', 'subtitle': 'Task management & project roadmap tracking', 'icon': LucideIcons.checkSquare};
      case 'books':
        return {'title': 'Books & Reading', 'subtitle': 'FreshRSS sync & reading sessions hub', 'icon': LucideIcons.book};
      case 'games':
        return {'title': 'Games Log', 'subtitle': 'Gaming activity tracker & library', 'icon': LucideIcons.gamepad2};
      case 'storage':
        return {'title': 'Storage', 'subtitle': 'Cloudflare R2 usage monitors & bucket manager', 'icon': LucideIcons.hardDrive};
      case 'gallery':
        return {'title': 'Photo Gallery', 'subtitle': 'EXIF photo library & album management', 'icon': LucideIcons.image};
      case 'uploads':
        return {'title': 'Uploads', 'subtitle': 'Cloudinary media upload manager', 'icon': LucideIcons.uploadCloud};
      case 'bookmarks':
        return {'title': 'Bookmarks', 'subtitle': 'Web link archive & article saver', 'icon': LucideIcons.bookmark};
      case 'quotes':
        return {'title': 'Quotes', 'subtitle': 'Literary quotes & highlight collection', 'icon': LucideIcons.quote};
      case 'links':
        return {'title': 'Links & RapidLink', 'subtitle': 'Custom short URL redirect service', 'icon': LucideIcons.link};
      default:
        return {'title': moduleKey.toUpperCase(), 'subtitle': 'Personal CMS Module', 'icon': LucideIcons.box};
    }
  }

  @override
  Widget build(BuildContext context) {
    final info = _getModuleInfo();
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 500),
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colorScheme.outline.withOpacity(0.2)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: colorScheme.primary.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  info['icon'] as IconData,
                  size: 40,
                  color: colorScheme.primary,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                info['title'],
                style: theme.textTheme.headlineMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                info['subtitle'],
                style: theme.textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: colorScheme.primary.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'INITIAL RELEASE FOCUS: MICROBLOG',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                    color: colorScheme.primary,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () {
                  ToastNotification.show(
                    context,
                    title: 'Priority Recorded',
                    message: '${info['title']} requested for upcoming release.',
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: colorScheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                icon: const Icon(LucideIcons.bellRing, size: 16),
                label: const Text('Notify Me When Ready'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
