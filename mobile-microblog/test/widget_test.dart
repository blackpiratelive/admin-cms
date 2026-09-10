import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_microblog/core/models/microblog_post.dart';
import 'package:mobile_microblog/widgets/microblog_card.dart';
import 'package:mobile_microblog/screens/compose_modal.dart';
import 'package:mobile_microblog/screens/settings_screen.dart';
import 'package:mobile_microblog/main.dart';

void main() {
  group('MicroblogPost Model Tests', () {
    test('parses from standard CMS JSON correctly', () {
      final json = {
        'id': 'mb_123',
        'slug': 'hello-world',
        'contentMarkdown': 'Hello **world**! #flutter',
        'status': 'published',
        'tags': ['flutter', 'ios'],
        'images': ['https://example.com/photo.jpg'],
        'coverImageUrl': 'https://example.com/cover.jpg',
        'shortUrl': 'https://s.blackpirate.live/hw',
        'createdAt': '2026-09-10T12:00:00.000Z',
        'publishedAt': '2026-09-10T12:05:00.000Z',
        'updatedAt': '2026-09-10T12:10:00.000Z',
      };

      final post = MicroblogPost.fromJson(json);

      expect(post.id, 'mb_123');
      expect(post.slug, 'hello-world');
      expect(post.contentMarkdown, 'Hello **world**! #flutter');
      expect(post.isPublished, isTrue);
      expect(post.isDraft, isFalse);
      expect(post.tags, ['flutter', 'ios']);
      expect(post.images, ['https://example.com/photo.jpg']);
      expect(post.coverImageUrl, 'https://example.com/cover.jpg');
      expect(post.shortUrl, 'https://s.blackpirate.live/hw');
    });

    test('handles stringified tags and images gracefully', () {
      final json = {
        'id': 'mb_456',
        'slug': 'draft-test',
        'content': 'A draft thought',
        'status': 'draft',
        'tags': '["tech", "life"]',
        'images': '["https://example.com/1.png"]',
      };

      final post = MicroblogPost.fromJson(json);

      expect(post.id, 'mb_456');
      expect(post.contentMarkdown, 'A draft thought');
      expect(post.isDraft, isTrue);
      expect(post.isPublished, isFalse);
      expect(post.tags, ['tech', 'life']);
      expect(post.images, ['https://example.com/1.png']);
    });

    test('copyWith properly overrides values', () {
      final post = MicroblogPost(
        id: 'mb_1',
        slug: 'slug-1',
        contentMarkdown: 'Original text',
        status: 'draft',
        tags: ['one'],
        images: [],
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      final updated = post.copyWith(
        contentMarkdown: 'Updated text',
        status: 'published',
      );

      expect(updated.id, 'mb_1');
      expect(updated.contentMarkdown, 'Updated text');
      expect(updated.status, 'published');
      expect(updated.isPublished, isTrue);
    });

    test('MicroblogFetchResult parses list payload correctly', () {
      final payload = {
        'items': [
          {
            'id': '1',
            'slug': 'post-1',
            'contentMarkdown': 'First post',
            'status': 'published',
            'tags': ['one'],
            'images': [],
          },
          {
            'id': '2',
            'slug': 'post-2',
            'contentMarkdown': 'Second post',
            'status': 'draft',
            'tags': ['two'],
            'images': [],
          },
        ],
        'total': 2,
        'page': 1,
        'limit': 50,
        'totalPages': 1,
      };

      final result = MicroblogFetchResult.fromJson(payload);

      expect(result.total, 2);
      expect(result.items.length, 2);
      expect(result.items[0].slug, 'post-1');
      expect(result.items[1].slug, 'post-2');
    });
  });

  group('MicroblogCard Widget Tests', () {
    testWidgets('renders published post card with tags and time', (WidgetTester tester) async {
      final post = MicroblogPost(
        id: 'mb_test_card',
        slug: 'test-card',
        contentMarkdown: 'Testing Cupertino microblog card UI',
        status: 'published',
        tags: ['flutter', 'cupertino'],
        images: [],
        createdAt: DateTime.now(),
        publishedAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await tester.pumpWidget(
        CupertinoApp(
          home: CupertinoPageScaffold(
            child: SingleChildScrollView(
              child: MicroblogCard(
                post: post,
                onEdit: () {},
                onToggleStatus: () {},
                onDelete: () {},
              ),
            ),
          ),
        ),
      );

      expect(find.text('Published'), findsOneWidget);
      expect(find.text('#flutter'), findsOneWidget);
      expect(find.text('#cupertino'), findsOneWidget);
      expect(find.text('Testing Cupertino microblog card UI'), findsOneWidget);
      expect(find.byIcon(CupertinoIcons.ellipsis), findsOneWidget);
    });

    testWidgets('renders draft post card correctly', (WidgetTester tester) async {
      final post = MicroblogPost(
        id: 'mb_draft_card',
        slug: 'draft-card',
        contentMarkdown: 'Testing draft badge rendering',
        status: 'draft',
        tags: [],
        images: [],
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await tester.pumpWidget(
        CupertinoApp(
          home: CupertinoPageScaffold(
            child: MicroblogCard(
              post: post,
              onEdit: () {},
              onToggleStatus: () {},
              onDelete: () {},
            ),
          ),
        ),
      );

      expect(find.text('Draft'), findsOneWidget);
      expect(find.text('Testing draft badge rendering'), findsOneWidget);
    });
  });

  group('ComposeModal Widget Tests', () {
    testWidgets('renders compose modal and tracks word/character counts', (WidgetTester tester) async {
      await tester.pumpWidget(
        CupertinoApp(
          home: ComposeModal(
            onSaved: () {},
          ),
        ),
      );

      expect(find.text('New Microblog'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Publish Instantly'), findsOneWidget);
      expect(find.text('Draft'), findsOneWidget);
      expect(find.text('0 words · 0 chars'), findsOneWidget);

      // Enter text
      final textFieldFinder = find.byType(CupertinoTextField).first;
      await tester.enterText(textFieldFinder, 'Hello world microblog');
      await tester.pump();

      expect(find.text('3 words · 21 chars'), findsOneWidget);
    });

    testWidgets('pre-populates compose modal when editPost is provided', (WidgetTester tester) async {
      final post = MicroblogPost(
        id: 'mb_edit',
        slug: 'existing-post',
        contentMarkdown: 'Existing content to edit',
        status: 'draft',
        tags: ['existingtag'],
        images: [],
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await tester.pumpWidget(
        CupertinoApp(
          home: ComposeModal(
            editPost: post,
            onSaved: () {},
          ),
        ),
      );

      expect(find.text('Edit Post'), findsOneWidget);
      expect(find.text('Existing content to edit'), findsOneWidget);
      expect(find.text('#existingtag'), findsOneWidget);
      expect(find.text('Update'), findsOneWidget);
    });
  });

  group('SettingsScreen Widget Tests', () {
    testWidgets('renders settings screen sections and items', (WidgetTester tester) async {
      await tester.pumpWidget(
        CupertinoApp(
          home: SettingsScreen(
            onLogout: () {},
          ),
        ),
      );

      expect(find.text('Settings'), findsOneWidget);
      expect(find.text('SERVER CONNECTION'), findsOneWidget);
      expect(find.text('Server URL'), findsOneWidget);
      expect(find.text('Rebuild Hugo Site'), findsOneWidget);
      expect(find.text('STORAGE & CACHE'), findsOneWidget);
      expect(find.text('Cached Microblogs'), findsOneWidget);
      expect(find.text('ABOUT'), findsOneWidget);
      expect(find.text('App Version'), findsOneWidget);
      expect(find.text('Sign Out'), findsOneWidget);
    });
  });

  group('CupertinoMicroblogApp Smoke Test', () {
    testWidgets('Renders CupertinoMicroblogApp without crashing', (WidgetTester tester) async {
      await tester.pumpWidget(const CupertinoMicroblogApp());
      expect(find.byType(CupertinoMicroblogApp), findsOneWidget);
    });
  });
}
