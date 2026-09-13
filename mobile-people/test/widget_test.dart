import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile_people/core/models/important_date.dart';
import 'package:mobile_people/core/models/social_links.dart';
import 'package:mobile_people/core/models/person_record.dart';
import 'package:mobile_people/core/models/person_connections.dart';
import 'package:mobile_people/core/models/person_timeline_item.dart';
import 'package:mobile_people/core/models/upcoming_birthday_item.dart';
import 'package:mobile_people/core/models/picker_items.dart';
import 'package:mobile_people/core/models/offline_mutation.dart';
import 'package:mobile_people/core/theme/liquid_glass_theme.dart';
import 'package:mobile_people/widgets/liquid_glass_container.dart';
import 'package:mobile_people/widgets/ambient_mesh_background.dart';
import 'package:mobile_people/widgets/floating_glass_header.dart';
import 'package:mobile_people/widgets/upcoming_birthdays_widget.dart';
import 'package:mobile_people/widgets/person_card.dart';
import 'package:mobile_people/screens/settings_screen.dart';
import 'package:mobile_people/main.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('ImportantDate Model Tests', () {
    test('parses from JSON correctly and serializes back to JSON', () {
      final json = {
        'id': 'date_1',
        'title': 'Birthday',
        'date': '1995-10-15',
        'reminderEnabled': true,
        'notes': 'Loved chocolate cake',
      };

      final date = ImportantDate.fromJson(json);
      expect(date.id, 'date_1');
      expect(date.title, 'Birthday');
      expect(date.date, '1995-10-15');
      expect(date.reminderEnabled, isTrue);
      expect(date.notes, 'Loved chocolate cake');

      final serialized = date.toJson();
      expect(serialized['id'], 'date_1');
      expect(serialized['reminderEnabled'], isTrue);
    });

    test('calculates daysRemaining and countdownBadge accurately', () {
      final now = DateTime.now();
      final todayMonth = now.month.toString().padLeft(2, '0');
      final todayDay = now.day.toString().padLeft(2, '0');

      final todayDate = ImportantDate(
        id: 'date_today',
        title: 'Anniversary',
        date: '2020-$todayMonth-$todayDay',
      );

      expect(todayDate.daysRemaining, 0);
      expect(todayDate.countdownBadge, 'Today!');

      final pastDate = ImportantDate(
        id: 'date_test',
        title: 'Past Event',
        date: '1990-01-01',
      );
      expect(pastDate.daysRemaining, greaterThanOrEqualTo(0));
      expect(pastDate.daysRemaining, lessThanOrEqualTo(366));
      expect(pastDate.countdownBadge, isNotEmpty);
    });

    test('copyWith works properly', () {
      final date = ImportantDate(
        id: 'd1',
        title: 'Original',
        date: '2000-01-01',
        reminderEnabled: false,
      );

      final updated = date.copyWith(
        title: 'Updated',
        reminderEnabled: true,
      );

      expect(updated.id, 'd1');
      expect(updated.title, 'Updated');
      expect(updated.reminderEnabled, isTrue);
    });
  });

  group('SocialLinks Model Tests', () {
    test('parses from JSON and provides URL helpers', () {
      final json = {
        'github': 'alice',
        'website': 'alice.dev',
        'instagram': 'alice_in_wonderland',
        'facebook': 'alice.fb',
        'linkedin': 'alice-johnson',
      };

      final links = SocialLinks.fromJson(json);
      expect(links.github, 'alice');
      expect(links.website, 'alice.dev');
      expect(links.instagram, 'alice_in_wonderland');
      expect(links.facebook, 'alice.fb');
      expect(links.linkedin, 'alice-johnson');
      expect(links.isNotEmpty, isTrue);
      expect(links.isEmpty, isFalse);

      expect(links.getGithubUrl(), 'https://github.com/alice');
      expect(links.getWebsiteUrl(), 'https://alice.dev');
      expect(links.getInstagramUrl(), 'https://instagram.com/alice_in_wonderland');
      expect(links.getFacebookUrl(), 'https://facebook.com/alice.fb');
      expect(links.getLinkedinUrl(), 'https://linkedin.com/in/alice-johnson');
    });

    test('empty links yields isEmpty true', () {
      final links = SocialLinks.fromJson({});
      expect(links.isEmpty, isTrue);
      expect(links.isNotEmpty, isFalse);
    });
  });

  group('PersonRecord Model Tests', () {
    test('parses full CMS JSON correctly', () {
      final json = {
        'id': 'p_100',
        'displayName': 'Alice Johnson',
        'firstName': 'Alice',
        'lastName': 'Johnson',
        'nickname': 'Ali',
        'slug': 'alice-johnson',
        'relationshipType': 'Close Friend',
        'favorite': true,
        'tags': ['colleague', 'mentor'],
        'interests': ['hiking', 'ai'],
        'notesMarkdown': '# Notes\nGreat collaborator.',
        'importantDates': [
          {
            'id': 'd_1',
            'title': 'Birthday',
            'date': '1992-05-12',
            'reminderEnabled': true,
          }
        ],
        'socialLinks': {
          'github': 'alice',
        },
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-01-02T00:00:00.000Z',
      };

      final person = PersonRecord.fromJson(json);
      expect(person.id, 'p_100');
      expect(person.displayName, 'Alice Johnson');
      expect(person.firstName, 'Alice');
      expect(person.lastName, 'Johnson');
      expect(person.nickname, 'Ali');
      expect(person.slug, 'alice-johnson');
      expect(person.relationshipType, 'Close Friend');
      expect(person.favorite, isTrue);
      expect(person.tags, ['colleague', 'mentor']);
      expect(person.interests, ['hiking', 'ai']);
      expect(person.importantDates.length, 1);
      expect(person.socialLinks.github, 'alice');
      expect(person.initials, 'AJ');
      expect(person.fullName, 'Alice Johnson');
    });

    test('handles single name initials and missing fields', () {
      final json = {
        'id': 'p_200',
        'name': 'Madonna',
        'slug': 'madonna',
      };

      final person = PersonRecord.fromJson(json);
      expect(person.initials, 'M');
      expect(person.relationshipType, 'Friend');
      expect(person.favorite, isFalse);
      expect(person.importantDates, isEmpty);
      expect(person.tags, isEmpty);
      expect(person.fullName, isNull);
    });

    test('copyWith properly updates fields', () {
      final original = const PersonRecord(
        id: 'p_1',
        displayName: 'Bob',
        slug: 'bob',
        relationshipType: 'Friend',
        favorite: false,
      );

      final updated = original.copyWith(
        displayName: 'Bob Smith',
        favorite: true,
        relationshipType: 'Family',
      );

      expect(updated.id, 'p_1');
      expect(updated.displayName, 'Bob Smith');
      expect(updated.favorite, isTrue);
      expect(updated.relationshipType, 'Family');
    });
  });

  group('PersonConnections and PickerItems Model Tests', () {
    test('PersonConnections parses list collections', () {
      final json = {
        'photos': [
          {'id': 'ph1', 'title': 'Summit Photo', 'thumbnailUrl': 'https://example.com/ph.jpg'}
        ],
        'locations': [
          {'id': 'loc1', 'name': 'Tokyo', 'city': 'Tokyo', 'country': 'Japan'}
        ],
        'trips': [
          {'id': 't1', 'title': 'Japan 2026', 'status': 'planned'}
        ],
        'microblogs': [
          {'id': 'm1', 'contentMarkdown': 'Great lunch with Bob'}
        ],
        'projects': [
          {'id': 'prj1', 'name': 'Admin CMS', 'status': 'active'}
        ],
        'collections': [
          {'id': 'c1', 'name': 'Favorites'}
        ],
      };

      final conn = PersonConnections.fromJson(json);
      expect(conn.photos.length, 1);
      expect(conn.locations.length, 1);
      expect(conn.trips.length, 1);
      expect(conn.microblogs.length, 1);
      expect(conn.projects.length, 1);
      expect(conn.collections.length, 1);
      expect(conn.totalCount, 6);
      expect(conn.isNotEmpty, isTrue);
      expect(conn.isEmpty, isFalse);
    });

    test('PeoplePickersResult parses multi-entity choices', () {
      final json = {
        'locations': [
          {'id': 'l1', 'name': 'Tokyo', 'city': 'Tokyo', 'country': 'Japan'}
        ],
        'trips': [
          {'id': 't1', 'title': 'Kyoto Trip', 'startDate': '2026-10-01'}
        ],
        'projects': [
          {'id': 'pr1', 'name': 'App', 'status': 'in_progress'}
        ],
        'microblogs': [
          {'id': 'm1', 'slug': 'post-one', 'contentMarkdown': 'Post summary'}
        ],
        'photos': [
          {'id': 'ph1', 'title': 'Pic 1', 'thumbnailUrl': 'https://example.com/thumb.jpg'}
        ],
        'collections': [
          {'id': 'c1', 'name': 'General', 'description': 'Main list'}
        ],
      };

      final pickers = PeoplePickersResult.fromJson(json);
      expect(pickers.locations.length, 1);
      expect(pickers.trips.length, 1);
      expect(pickers.projects.length, 1);
      expect(pickers.microblogs.length, 1);
      expect(pickers.photos.length, 1);
      expect(pickers.collections.length, 1);
      expect(pickers.getByType('location').length, 1);
      expect(pickers.getByType('trip').length, 1);
    });

    test('PersonTimelineItem parses composite timeline entry', () {
      final json = {
        'id': 'item_1',
        'type': 'trip',
        'title': 'Tokyo Adventure',
        'description': 'Planned autumn trip',
        'date': '2026-10-01T00:00:00.000Z',
      };

      final item = PersonTimelineItem.fromJson(json);
      expect(item.type, 'trip');
      expect(item.title, 'Tokyo Adventure');
      expect(item.description, 'Planned autumn trip');
      expect(item.iconData, CupertinoIcons.airplane);
      expect(item.nodeColor, const Color(0xFF8B5CF6));
    });
  });

  group('UpcomingBirthdayItem Model Tests', () {
    test('parses from JSON and calculates countdownBadge correctly', () {
      final json = {
        'personId': 'p_1',
        'displayName': 'Sarah Connor',
        'slug': 'sarah-connor',
        'relationshipType': 'Family',
        'title': 'Birthday',
        'dateStr': '1984-05-12',
        'daysRemaining': 3,
      };

      final birthday = UpcomingBirthdayItem.fromJson(json);
      expect(birthday.personId, 'p_1');
      expect(birthday.displayName, 'Sarah Connor');
      expect(birthday.daysRemaining, 3);
      expect(birthday.countdownBadge, 'in 3 days');
      expect(birthday.initials, 'SC');
    });

    test('today and tomorrow return proper badge text', () {
      const bToday = UpcomingBirthdayItem(
        personId: 'b_today',
        displayName: 'John Doe',
        slug: 'john-doe',
        title: 'Birthday',
        dateStr: '2000-01-01',
        daysRemaining: 0,
      );
      expect(bToday.countdownBadge, 'Today!');

      const bTomorrow = UpcomingBirthdayItem(
        personId: 'b_tomorrow',
        displayName: 'Jane Doe',
        slug: 'jane-doe',
        title: 'Birthday',
        dateStr: '2000-01-02',
        daysRemaining: 1,
      );
      expect(bTomorrow.countdownBadge, 'Tomorrow');
    });
  });

  group('OfflineMutation Model Tests', () {
    test('serializes and deserializes queued mutation', () {
      const mutation = OfflineMutation(
        id: 'mut_123',
        type: 'create_person',
        entityId: 'p_123',
        payload: {'displayName': 'Charlie', 'relationshipType': 'Friend'},
        timestamp: '2026-09-13T12:00:00.000Z',
      );

      final json = mutation.toJson();
      final restored = OfflineMutation.fromJson(json);

      expect(restored.id, 'mut_123');
      expect(restored.type, 'create_person');
      expect(restored.entityId, 'p_123');
      expect(restored.timestamp, '2026-09-13T12:00:00.000Z');
      expect(restored.payload['displayName'], 'Charlie');
    });
  });

  group('Liquid Glass Theme System Tests', () {
    test('returns correct decoration tokens', () {
      final ledZero = LiquidGlassTheme.jewelCountdown(daysRemaining: 0);
      expect(ledZero.color, CupertinoColors.systemRed);

      final ledOne = LiquidGlassTheme.jewelCountdown(daysRemaining: 1);
      expect(ledOne.color, CupertinoColors.systemOrange);

      final ledSeven = LiquidGlassTheme.jewelCountdown(daysRemaining: 5);
      expect(ledSeven.color, CupertinoColors.systemYellow);

      final ledOther = LiquidGlassTheme.jewelCountdown(daysRemaining: 20);
      expect(ledOther.color, const Color(0xFF8B5CF6));
    });
  });

  group('LiquidGlassContainer Widget Tests', () {
    testWidgets('renders child and triggers tap callback', (WidgetTester tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        CupertinoApp(
          home: CupertinoPageScaffold(
            child: Center(
              child: LiquidGlassContainer(
                interactive: true,
                onTap: () => tapped = true,
                child: const Text('Liquid Glass Content'),
              ),
            ),
          ),
        ),
      );

      expect(find.text('Liquid Glass Content'), findsOneWidget);
      await tester.tap(find.text('Liquid Glass Content'));
      await tester.pumpAndSettle();
      expect(tapped, isTrue);
    });
  });

  group('AmbientMeshBackground Widget Tests', () {
    testWidgets('renders background mesh and child widget', (WidgetTester tester) async {
      final controller = ScrollController();

      await tester.pumpWidget(
        CupertinoApp(
          home: CupertinoPageScaffold(
            child: AmbientMeshBackground(
              scrollController: controller,
              child: const Text('Mesh Foreground Child'),
            ),
          ),
        ),
      );

      expect(find.text('Mesh Foreground Child'), findsOneWidget);
      controller.dispose();
    });
  });

  group('FloatingGlassHeader Widget Tests', () {
    testWidgets('renders title, count badge, and triggers buttons', (WidgetTester tester) async {
      bool settingsTapped = false;
      bool addTapped = false;

      await tester.pumpWidget(
        CupertinoApp(
          home: CupertinoPageScaffold(
            child: FloatingGlassHeader(
              title: 'People & Memories',
              count: 28,
              onSettingsTap: () => settingsTapped = true,
              onAddTap: () => addTapped = true,
            ),
          ),
        ),
      );

      expect(find.text('People & Memories'), findsOneWidget);
      expect(find.text('28'), findsOneWidget);

      await tester.tap(find.byIcon(CupertinoIcons.gear));
      await tester.pumpAndSettle();
      expect(settingsTapped, isTrue);

      await tester.tap(find.byIcon(CupertinoIcons.add));
      await tester.pumpAndSettle();
      expect(addTapped, isTrue);
    });
  });

  group('UpcomingBirthdaysWidget Widget Tests', () {
    testWidgets('renders horizontal tray and triggers item tap', (WidgetTester tester) async {
      UpcomingBirthdayItem? selected;
      final birthdays = [
        const UpcomingBirthdayItem(
          personId: 'b1',
          displayName: 'Sarah Connor',
          slug: 'sarah-connor',
          relationshipType: 'Family',
          title: 'Birthday',
          dateStr: '1984-05-12',
          daysRemaining: 2,
        ),
        const UpcomingBirthdayItem(
          personId: 'b2',
          displayName: 'John Wick',
          slug: 'john-wick',
          relationshipType: 'Close Friend',
          title: 'Birthday',
          dateStr: '1975-09-02',
          daysRemaining: 10,
        ),
      ];

      await tester.pumpWidget(
        CupertinoApp(
          home: CupertinoPageScaffold(
            child: UpcomingBirthdaysWidget(
              items: birthdays,
              onItemTap: (b) => selected = b,
            ),
          ),
        ),
      );

      expect(find.text('Upcoming Dates & Birthdays'), findsOneWidget);
      expect(find.text('Sarah Connor'), findsOneWidget);
      expect(find.text('John Wick'), findsOneWidget);
      expect(find.text('Birthday • in 2 days'), findsOneWidget);

      await tester.tap(find.text('Sarah Connor'));
      await tester.pumpAndSettle();
      expect(selected?.personId, 'b1');
    });
  });

  group('PersonCard Widget Tests', () {
    testWidgets('renders person card details and toggles favorite', (WidgetTester tester) async {
      bool cardTapped = false;
      bool favoriteToggled = false;

      const person = PersonRecord(
        id: 'p_test',
        displayName: 'Dr. Evelyn Reed',
        slug: 'dr-evelyn-reed',
        relationshipType: 'Mentor',
        favorite: true,
        interests: ['research', 'ai'],
      );

      await tester.pumpWidget(
        CupertinoApp(
          home: CupertinoPageScaffold(
            child: SingleChildScrollView(
              child: PersonCard(
                person: person,
                onTap: () => cardTapped = true,
                onToggleFavorite: () => favoriteToggled = true,
                onEdit: () {},
                onDelete: () {},
              ),
            ),
          ),
        ),
      );

      expect(find.text('Dr. Evelyn Reed'), findsOneWidget);
      expect(find.text('Mentor'), findsOneWidget);
      expect(find.text('#research'), findsOneWidget);
      expect(find.text('#ai'), findsOneWidget);
      expect(find.byIcon(CupertinoIcons.star_fill), findsOneWidget);

      await tester.tap(find.byIcon(CupertinoIcons.star_fill));
      await tester.pumpAndSettle();
      expect(favoriteToggled, isTrue);

      await tester.tap(find.text('Dr. Evelyn Reed'));
      await tester.pumpAndSettle();
      expect(cardTapped, isTrue);
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
      expect(find.text('VISUAL PERFORMANCE'), findsOneWidget);
      expect(find.text('Liquid Glass Effects'), findsOneWidget);
      expect(find.text('OFFLINE & SYNC QUEUE'), findsOneWidget);
      expect(find.text('Queued Mutations'), findsOneWidget);
      expect(find.text('ACCOUNT & ABOUT'), findsOneWidget);
      expect(find.text('Sign Out'), findsOneWidget);
    });
  });

  group('CupertinoPeopleApp Smoke Test', () {
    testWidgets('Renders CupertinoPeopleApp without crashing', (WidgetTester tester) async {
      await tester.pumpWidget(const CupertinoPeopleApp());
      expect(find.byType(CupertinoPeopleApp), findsOneWidget);
    });
  });
}
