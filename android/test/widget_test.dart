import 'package:flutter_test/flutter_test.dart';
import 'package:android/main.dart';

void main() {
  testWidgets('Personal CMS App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const PersonalCmsApp());
    expect(find.byType(PersonalCmsApp), findsOneWidget);
  });
}
