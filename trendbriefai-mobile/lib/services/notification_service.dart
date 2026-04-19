import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'api_service.dart';

class NotificationService {
  final ApiService _api;
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  NotificationService(this._api);

  Future<void> init() async {
    final settings = await _messaging.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      final token = await _messaging.getToken();
      if (token != null) {
        final platform = Platform.isIOS ? 'ios' : 'android';
        await _api.registerDeviceToken(token, platform);
      }

      _messaging.onTokenRefresh.listen((newToken) {
        final platform = Platform.isIOS ? 'ios' : 'android';
        _api.registerDeviceToken(newToken, platform);
      });
    }

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((message) {
      // Could show local notification here
    });
  }

  Future<bool> get hasPermission async {
    final settings = await _messaging.getNotificationSettings();
    return settings.authorizationStatus == AuthorizationStatus.authorized;
  }
}
