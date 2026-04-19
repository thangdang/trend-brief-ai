import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class OnboardingProvider extends ChangeNotifier {
  static const _key = 'onboarding_completed';
  bool _completed = false;

  bool get completed => _completed;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _completed = prefs.getBool(_key) ?? false;
    notifyListeners();
  }

  Future<void> markCompleted() async {
    _completed = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, true);
    notifyListeners();
  }
}
