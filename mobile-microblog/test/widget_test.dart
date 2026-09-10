import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_microblog/core/models/microblog_post.dart';
import 'package:mobile_microblog/core/models/location_item.dart';
import 'package:mobile_microblog/core/models/trip_item.dart';
import 'package:mobile_microblog/widgets/microblog_card.dart';
import 'package:mobile_microblog/screens/compose_modal.dart';
import 'package:mobile_microblog/screens/settings_screen.dart';
import 'package:mobile_microblog/core/theme/liquid_glass_theme.dart';
import 'package:mobile_microblog/widgets/liquid_glass_container.dart';
import 'package:mobile_microblog/widgets/ambient_mesh_background.dart';
import 'package:mobile_microblog/widgets/floating_glass_header.dart';
import 'package:mobile_microblog/main.dart';

void main() {
  group('LocationItem and TripItem Model Tests', () {
    test('LocationItem parses from JSON and formats displayName correctly', () {
      final json = {
        'id': 'loc_1',
        'name': 'Tokyo Tower',
        'slug': 'tokyo-tower',
        'city': 'Tokyo',
        'country': 'Japan',
      };

      final loc = LocationItem.fromJson(json);
      expect(loc.id, 'loc_1');
      expect(loc.name, 'Tokyo Tower');
      expect(loc.slug, 'tokyo-tower');
      expect(loc.city, 'Tokyo');
      expect(loc.country, 'Japan');
      expect(loc.displayName, 'Tokyo Tower, Tokyo, Japan');
      expect(loc.subtitle, 'Tokyo, Japan');
    });

    test('TripItem parses from JSON and formats displayStatus correctly', () {
      final json = {
        'id': 'trip_1',
        'title': 'Japan Autumn 2026',
        'slug': 'japan-autumn-2026',
        'status': 'planned',
      };

      final trip = TripItem.fromJson(json);
      expect(trip.id, 'trip_1');
      expect(trip.title, 'Japan Autumn 2026');
      expect(trip.slug, 'japan-autumn-2026');
      expect(trip.status, 'planned');
      expect(trip.displayStatus, 'Planned');
    });
  });

  group('MicroblogPost Model Tests', () {
    test('parses from standard CMS JSON correctly with location and trip', () {
      final json = {
        'id': 'mb_123',
        'slug': 'hello-world',
        'contentMarkdown': 'Hello **world**! #flutter',
        'status': 'published',
        'tags': ['flutter', 'ios'],
        'images': ['https://example.com/photo.jpg'],
        'coverImageUrl': 'https://example.com/cover.jpg',
        'shortUrl': 'https://s.blackpirate.live/hw',
        'locationId': 'loc_1',
        'locationName': 'Tokyo Tower',
        'locationCity': 'Tokyo',
        'tripId': 'trip_1',
        'tripTitle': 'Japan Autumn 2026',
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
      expect(post.locationId, 'loc_1');
      expect(post.locationName, 'Tokyo Tower');
      expect(post.locationCity, 'Tokyo');
      expect(post.tripId, 'trip_1');
      expect(post.tripTitle, 'Japan Autumn 2026');
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

    test('copyWith properly overrides values including location and trip', () {
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
        locationName: 'Shibuya Crossing',
        tripTitle: 'Tokyo Trip',
      );

      expect(updated.id, 'mb_1');
      expect(updated.contentMarkdown, 'Updated text');
      expect(updated.status, 'published');
      expect(updated.isPublished, isTrue);
      expect(updated.locationName, 'Shibuya Crossing');
      expect(updated.tripTitle, 'Tokyo Trip');
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
            'locationName': 'Kyoto Temple',
            'tripTitle': 'Japan 2026',
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
      expect(result.items[0].locationName, 'Kyoto Temple');
      expect(result.items[0].tripTitle, 'Japan 2026');
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

    testWidgets('renders location and trip pills on card', (WidgetTester tester) async {
      final post = MicroblogPost(
        id: 'mb_assoc_card',
        slug: 'assoc-card',
        contentMarkdown: 'Visiting Tokyo today!',
        status: 'published',
        tags: ['travel'],
        locationName: 'Tokyo Tower',
        locationCity: 'Tokyo',
        tripTitle: 'Japan Vacation',
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

      expect(find.text('Tokyo Tower (Tokyo)'), findsOneWidget);
      expect(find.text('Japan Vacation'), findsOneWidget);
      expect(find.byIcon(CupertinoIcons.location_solid), findsOneWidget);
      expect(find.byIcon(CupertinoIcons.airplane), findsOneWidget);
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
      expect(find.text('Advanced Options'), findsOneWidget);

      // Enter text in content field
      final textFieldFinder = find.byType(CupertinoTextField).first;
      await tester.enterText(textFieldFinder, 'Hello world microblog');
      await tester.pump();

      expect(find.text('3 words · 21 chars'), findsOneWidget);
    });

    testWidgets('pre-populates compose modal with editPost data, slug, and associations', (WidgetTester tester) async {
      final post = MicroblogPost(
        id: 'mb_edit',
        slug: 'existing-post-slug',
        contentMarkdown: 'Existing content to edit',
        status: 'draft',
        tags: ['existingtag'],
        locationId: 'loc_test',
        locationName: 'Mount Fuji',
        tripId: 'trip_test',
        tripTitle: 'Summer Climbing',
        images: ['https://example.com/attached.jpg'],
        coverImageUrl: 'https://example.com/cover.jpg',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

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
      expect(find.text('Advanced Options'), findsOneWidget);
      expect(find.text('existing-post-slug'), findsOneWidget);
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
      expect(find.text('APPEARANCE & EFFECTS'), findsOneWidget);
      expect(find.text('Liquid Glass Effects'), findsOneWidget);
      expect(find.text('STORAGE & CACHE'), findsOneWidget);
      expect(find.text('Cached Microblogs'), findsOneWidget);
      expect(find.text('ABOUT'), findsOneWidget);
      expect(find.text('App Version'), findsOneWidget);
      expect(find.text('Sign Out'), findsOneWidget);
    });
  });

  group('Liquid Glass System Tests', () {
    test('LiquidGlassTheme tokens and jewel LED decorations', () {
      final pubLed = LiquidGlassTheme.jewelLed(isPublished: true);
      expect(pubLed.color, CupertinoColors.systemGreen);
      expect(pubLed.boxShadow, isNotEmpty);

      final draftLed = LiquidGlassTheme.jewelLed(isPublished: false);
      expect(draftLed.color, CupertinoColors.systemOrange);
      expect(draftLed.boxShadow, isNotEmpty);
    });

    testWidgets('LiquidGlassContainer renders child and responds to tap', (WidgetTester tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        CupertinoApp(
          home: CupertinoPageScaffold(
            child: Center(
              child: LiquidGlassContainer(
                interactive: true,
                onTap: () => tapped = true,
                child: const Text('Glass Content'),
              ),
            ),
          ),
        ),
      );

      expect(find.text('Glass Content'), findsOneWidget);
      await tester.tap(find.text('Glass Content'));
      await tester.pumpAndSettle();
      expect(tapped, isTrue);
    });

    testWidgets('AmbientMeshBackground renders canvas with child', (WidgetTester tester) async {
      final scrollController = ScrollController();

      await tester.pumpWidget(
        CupertinoApp(
          home: CupertinoPageScaffold(
            child: AmbientMeshBackground(
              scrollController: scrollController,
              child: const Text('Foreground Content'),
            ),
          ),
        ),
      );

      expect(find.text('Foreground Content'), findsOneWidget);
      scrollController.dispose();
    });

    testWidgets('FloatingGlassHeader renders title, count badge, and actions', (WidgetTester tester) async {
      bool settingsOpened = false;
      bool composerOpened = false;

      await tester.pumpWidget(
        CupertinoApp(
          home: CupertinoPageScaffold(
            child: FloatingGlassHeader(
              totalCount: 42,
              onOpenSettings: () => settingsOpened = true,
              onOpenComposer: () => composerOpened = true,
            ),
          ),
        ),
      );

      expect(find.text('Microblog'), findsOneWidget);
      expect(find.text('42'), findsOneWidget);

      await tester.tap(find.byIcon(CupertinoIcons.gear_alt_fill));
      await tester.pumpAndSettle();
      expect(settingsOpened, isTrue);

      await tester.tap(find.byIcon(CupertinoIcons.add));
      await tester.pumpAndSettle();
      expect(composerOpened, isTrue);
    });
  });

  group('CupertinoMicroblogApp Smoke Test', () {
    testWidgets('Renders CupertinoMicroblogApp without crashing', (WidgetTester tester) async {
      await tester.pumpWidget(const CupertinoMicroblogApp());
      expect(find.byType(CupertinoMicroblogApp), findsOneWidget);
    });
  });
}
