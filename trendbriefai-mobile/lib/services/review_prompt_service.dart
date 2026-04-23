import 'package:in_app_review/in_app_review.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ReviewPromptService {
  static const _daysOpenedKey = 'review_days_opened';
  static const _articlesViewedKey = 'review_articles_viewed';
  static const _lastPromptKey = 'review_last_prompt';
  static const _lastDayKey = 'review_last_day';

  static const _minDaysOpened = 5;
  static const _minArticlesViewed = 7; // Tuned: trigger after 7th article view (Task 31.2)
  static const _cooldownDays = 90;

  Future<void> incrementDaysOpened() async {
    final prefs = await SharedPreferences.getInstance();
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final lastDay = prefs.getString(_lastDayKey);
    if (lastDay != today) {
      final count = (prefs.getInt(_daysOpenedKey) ?? 0) + 1;
      await prefs.setInt(_daysOpenedKey, count);
      await prefs.setString(_lastDayKey, today);
    }
  }

  Future<void> incrementArticlesViewed() async {
    final prefs = await SharedPreferences.getInstance();
    final count = (prefs.getInt(_articlesViewedKey) ?? 0) + 1;
    await prefs.setInt(_articlesViewedKey, count);
  }

  Future<bool> isEligible() async {
    final prefs = await SharedPreferences.getInstance();
    final daysOpened = prefs.getInt(_daysOpenedKey) ?? 0;
    final articlesViewed = prefs.getInt(_articlesViewedKey) ?? 0;
    final lastPromptMs = prefs.getInt(_lastPromptKey);

    if (daysOpened < _minDaysOpened) return false;
    if (articlesViewed < _minArticlesViewed) return false;

    if (lastPromptMs != null) {
      final lastPrompt = DateTime.fromMillisecondsSinceEpoch(lastPromptMs);
      final daysSince = DateTime.now().difference(lastPrompt).inDays;
      if (daysSince < _cooldownDays) return false;
    }

    return true;
  }

  Future<void> checkAndPrompt() async {
    if (!await isEligible()) return;

    final inAppReview = InAppReview.instance;
    if (await inAppReview.isAvailable()) {
      await inAppReview.requestReview();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_lastPromptKey, DateTime.now().millisecondsSinceEpoch);
    }
  }
}
