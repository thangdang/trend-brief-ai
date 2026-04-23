import 'dart:convert';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_service.dart';

/// Top-level handler for background/terminated FCM messages.
/// Must be a top-level function (not a class method) for Firebase.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Background messages are handled by the system notification tray.
  // Navigation on tap is handled via getInitialMessage / onMessageOpenedApp.
  debugPrint('[FCM] Background message: ${message.messageId}');
}

class NotificationService {
  final ApiService _api;
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  /// Global navigator key — set from main.dart so we can navigate on tap.
  static GlobalKey<NavigatorState>? navigatorKey;

  /// Track whether init has been called to avoid double-init.
  bool _initialized = false;

  NotificationService(this._api);

  // ---------------------------------------------------------------------------
  // Android notification channel
  // ---------------------------------------------------------------------------

  static const _androidChannel = AndroidNotificationChannel(
    'trendbriefai_default',
    'TrendBrief AI',
    description: 'Thông báo tin tức từ TrendBrief AI',
    importance: Importance.high,
  );

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /// Call once at app startup (after Firebase.initializeApp).
  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    // 1. Request permission (UX-14.1)
    await _requestPermission();

    // 2. Set up local notifications plugin (for foreground display)
    await _setupLocalNotifications();

    // 3. Create Android notification channel
    await _createAndroidChannel();

    // 4. Register FCM token with backend
    await _registerToken();

    // 5. Listen for token refresh
    _messaging.onTokenRefresh.listen(_onTokenRefresh);

    // 6. Handle foreground messages — show local notification
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    // 7. Handle notification tap when app is in background
    FirebaseMessaging.onMessageOpenedApp.listen(_onNotificationTap);

    // 8. Handle notification tap when app was terminated
    await _handleTerminatedTap();

    // 9. Configure foreground notification presentation (iOS)
    await _messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
  }

  // ---------------------------------------------------------------------------
  // Permission (UX-14.1)
  // ---------------------------------------------------------------------------

  Future<void> _requestPermission() async {
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
  }

  /// Check current permission status.
  Future<bool> get hasPermission async {
    final settings = await _messaging.getNotificationSettings();
    return settings.authorizationStatus == AuthorizationStatus.authorized;
  }

  // ---------------------------------------------------------------------------
  // Local notifications setup (foreground display)
  // ---------------------------------------------------------------------------

  Future<void> _setupLocalNotifications() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    const initSettings = InitializationSettings(
      android: androidInit,
      iOS: iosInit,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onLocalNotificationTap,
    );
  }

  Future<void> _createAndroidChannel() async {
    final androidPlugin =
        _localNotifications.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(_androidChannel);
  }

  // ---------------------------------------------------------------------------
  // FCM token management
  // ---------------------------------------------------------------------------

  Future<void> _registerToken() async {
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        final platform = Platform.isIOS ? 'ios' : 'android';
        await _api.registerDeviceToken(token, platform);
      }
    } catch (e) {
      debugPrint('[FCM] Token registration failed: $e');
    }
  }

  void _onTokenRefresh(String newToken) {
    final platform = Platform.isIOS ? 'ios' : 'android';
    _api.registerDeviceToken(newToken, platform).catchError((e) {
      debugPrint('[FCM] Token refresh registration failed: $e');
    });
  }

  /// Unregister the current device token (e.g. on logout or toggle off).
  Future<void> unregisterToken() async {
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        await _api.unregisterDeviceToken(token);
      }
    } catch (e) {
      debugPrint('[FCM] Token unregister failed: $e');
    }
  }

  // ---------------------------------------------------------------------------
  // Foreground message handling
  // ---------------------------------------------------------------------------

  void _onForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    // Show a local notification so the user sees it while app is open.
    _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _androidChannel.id,
          _androidChannel.name,
          channelDescription: _androidChannel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      // Pass deep link data as payload so tap can navigate.
      payload: jsonEncode(message.data),
    );
  }

  // ---------------------------------------------------------------------------
  // Notification tap handling — deep link navigation (UX-14.3)
  // ---------------------------------------------------------------------------

  /// Called when user taps a notification while app is in background.
  void _onNotificationTap(RemoteMessage message) {
    _navigateFromData(message.data);
  }

  /// Called when app was terminated and opened via notification tap.
  Future<void> _handleTerminatedTap() async {
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      // Small delay to let the navigator settle after app startup.
      Future.delayed(const Duration(milliseconds: 500), () {
        _navigateFromData(initialMessage.data);
      });
    }
  }

  /// Called when user taps a local notification (foreground-shown).
  void _onLocalNotificationTap(NotificationResponse response) {
    if (response.payload == null) return;
    try {
      final data = jsonDecode(response.payload!) as Map<String, dynamic>;
      _navigateFromData(data);
    } catch (_) {}
  }

  /// Navigate based on notification data payload.
  ///
  /// Expected data keys from backend:
  /// - `articleId` → navigate to `/article/{id}`
  /// - `topic` → navigate to `/feed?topic={t}` (handled as home with topic)
  /// - `deepLink` → raw deep link path (fallback)
  void _navigateFromData(Map<String, dynamic> data) {
    final navigator = navigatorKey?.currentState;
    if (navigator == null) return;

    final articleId = data['articleId'] as String?;
    final deepLink = data['deepLink'] as String?;

    if (articleId != null && articleId.isNotEmpty) {
      navigator.pushNamed('/article/$articleId');
      return;
    }

    // Parse deep link: /article/{id} or /feed?topic={t}
    if (deepLink != null && deepLink.isNotEmpty) {
      if (deepLink.startsWith('/article/')) {
        navigator.pushNamed(deepLink);
        return;
      }
      // For /feed?topic=X, just go to home (feed is the default tab)
      if (deepLink.startsWith('/feed')) {
        navigator.pushNamedAndRemoveUntil('/home', (route) => false);
        return;
      }
    }

    // Default: go to home/feed
    navigator.pushNamedAndRemoveUntil('/home', (route) => false);
  }
}
