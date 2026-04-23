import 'dart:async';
import 'dart:ui';

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

/// Centralized crash reporting service wrapping Firebase Crashlytics.
///
/// Call [initialize] once after Firebase.initializeApp() to set up
/// all error handlers (Flutter errors, async errors, platform errors).
class CrashReportingService {
  static final CrashReportingService _instance = CrashReportingService._();
  factory CrashReportingService() => _instance;
  CrashReportingService._();

  FirebaseCrashlytics get _crashlytics => FirebaseCrashlytics.instance;

  /// Initializes Crashlytics collection and error handlers.
  ///
  /// Returns a [Function] that should be used as the body of
  /// [runZonedGuarded] to capture uncaught zone errors.
  Future<void> initialize() async {
    // Enable collection (disable in debug if desired)
    await _crashlytics.setCrashlyticsCollectionEnabled(!kDebugMode);

    // Capture Flutter framework errors (widget build errors, etc.)
    FlutterError.onError = (errorDetails) {
      _crashlytics.recordFlutterFatalError(errorDetails);
    };

    // Capture async errors not caught by Flutter framework
    PlatformDispatcher.instance.onError = (error, stack) {
      _crashlytics.recordError(error, stack, fatal: true);
      return true;
    };
  }

  /// Handler for [runZonedGuarded] onError callback.
  void onZoneError(Object error, StackTrace stack) {
    _crashlytics.recordError(error, stack, fatal: true);
  }

  /// Log a non-fatal error with optional context.
  Future<void> recordError(
    dynamic exception,
    StackTrace? stack, {
    String? reason,
    bool fatal = false,
  }) {
    return _crashlytics.recordError(
      exception,
      stack,
      reason: reason ?? 'Non-fatal error',
      fatal: fatal,
    );
  }

  /// Log a message to Crashlytics (visible in crash session logs).
  Future<void> log(String message) {
    return _crashlytics.log(message);
  }

  /// Set a custom key-value pair for crash context.
  Future<void> setCustomKey(String key, Object value) {
    return _crashlytics.setCustomKey(key, value);
  }

  /// Set the user identifier for crash reports.
  Future<void> setUserIdentifier(String userId) {
    return _crashlytics.setUserIdentifier(userId);
  }
}
