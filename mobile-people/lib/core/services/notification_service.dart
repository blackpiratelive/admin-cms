import 'dart:io';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../models/person_record.dart';

class NotificationService {
  static final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwinSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const linuxSettings = LinuxInitializationSettings(defaultActionName: 'Open notification');

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: darwinSettings,
      macOS: darwinSettings,
      linux: linuxSettings,
    );

    try {
      await _notificationsPlugin.initialize(
        initSettings,
      );

      _initialized = true;

      // Request permissions on Android 13+ and iOS
      if (Platform.isAndroid) {
        await _notificationsPlugin
            .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
            ?.requestNotificationsPermission();
      } else if (Platform.isIOS || Platform.isMacOS) {
        await _notificationsPlugin
            .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
            ?.requestPermissions(
              alert: true,
              badge: true,
              sound: true,
            );
      }
    } catch (_) {
      // In tests or unsupported environments, gracefully continue
      _initialized = true;
    }
  }

  /// Show an immediate notification
  static Future<void> showNotification({
    required int id,
    required String title,
    required String body,
  }) async {
    await initialize();

    const androidDetails = AndroidNotificationDetails(
      'people_reminders_channel',
      'Important Date Reminders',
      channelDescription: 'Notifications for birthdays and important relationship dates',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );

    const darwinDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: darwinDetails,
      macOS: darwinDetails,
    );

    await _notificationsPlugin.show(
      id,
      title,
      body,
      notificationDetails,
    );
  }

  /// Schedule reminders for all dates marked with reminderEnabled in a person's profile
  static Future<void> scheduleRemindersForPerson(PersonRecord person) async {
    await initialize();

    for (final date in person.importantDates) {
      if (!date.reminderEnabled || date.date.isEmpty) continue;

      final diffDays = date.daysRemaining;
      if (diffDays >= 0 && diffDays <= 60) {
        final notifId = (person.id.hashCode ^ date.id.hashCode).abs() % 100000;
        final title = diffDays == 0
            ? "🎉 Today is ${person.displayName}'s ${date.title}!"
            : diffDays == 1
                ? "⏰ Tomorrow is ${person.displayName}'s ${date.title}!"
                : "📅 ${person.displayName}'s ${date.title} in $diffDays days";
        final body = date.notes != null && date.notes!.isNotEmpty
            ? date.notes!
            : "Remember to wish ${person.displayName} a happy ${date.title}!";

        // If it's today or tomorrow, display notification
        if (diffDays <= 1) {
          await showNotification(
            id: notifId,
            title: title,
            body: body,
          );
        }
      }
    }
  }

  /// Schedule reminders across all loaded people
  static Future<void> scheduleAllReminders(List<PersonRecord> people) async {
    for (final person in people) {
      await scheduleRemindersForPerson(person);
    }
  }

  static Future<void> cancelReminder(int id) async {
    await _notificationsPlugin.cancel(id);
  }

  static Future<void> cancelAll() async {
    await _notificationsPlugin.cancelAll();
  }
}
