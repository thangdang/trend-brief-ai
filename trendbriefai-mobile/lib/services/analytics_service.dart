import 'package:firebase_analytics/firebase_analytics.dart';

/// Singleton wrapper around [FirebaseAnalytics] for custom event tracking.
///
/// Tracks: screen_view, article_view, article_share, bookmark_add.
class AnalyticsService {
  AnalyticsService._();
  static final AnalyticsService _instance = AnalyticsService._();
  factory AnalyticsService() => _instance;

  final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;

  /// Returns the [FirebaseAnalyticsObserver] for automatic screen tracking
  /// via MaterialApp's navigatorObservers.
  FirebaseAnalyticsObserver get observer =>
      FirebaseAnalyticsObserver(analytics: _analytics);

  /// Logs a screen_view event with the given [screenName].
  Future<void> logScreenView(String screenName) async {
    await _analytics.logScreenView(screenName: screenName);
  }

  /// Logs a custom article_view event.
  Future<void> logArticleView(String articleId, String topic) async {
    await _analytics.logEvent(
      name: 'article_view',
      parameters: {'article_id': articleId, 'topic': topic},
    );
  }

  /// Logs a custom article_share event.
  Future<void> logArticleShare(String articleId, String topic) async {
    await _analytics.logEvent(
      name: 'article_share',
      parameters: {'article_id': articleId, 'topic': topic},
    );
  }

  /// Logs a custom bookmark_add event.
  Future<void> logBookmarkAdd(String articleId, String topic) async {
    await _analytics.logEvent(
      name: 'bookmark_add',
      parameters: {'article_id': articleId, 'topic': topic},
    );
  }
}
