import 'package:flutter/foundation.dart';
import '../models/auth_tokens.dart';
import '../models/user_profile.dart';
import 'api_service.dart';

class AuthService extends ChangeNotifier {
  final ApiService _api;
  bool _isLoggedIn = false;
  UserProfile? _profile;

  AuthService(this._api);

  bool get isLoggedIn => _isLoggedIn;
  UserProfile? get profile => _profile;

  Future<void> checkAuth() async {
    _isLoggedIn = await _api.hasToken();
    if (_isLoggedIn) {
      try {
        _profile = await _api.getProfile();
      } catch (_) {
        _isLoggedIn = false;
        await _api.clearTokens();
      }
    }
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    await _api.login(email, password);
    _isLoggedIn = true;
    _profile = await _api.getProfile();
    notifyListeners();
  }

  Future<void> register(String email, String password) async {
    await _api.register(email, password);
    _isLoggedIn = true;
    _profile = await _api.getProfile();
    notifyListeners();
  }

  Future<void> logout() async {
    await _api.logout();
    _isLoggedIn = false;
    _profile = null;
    notifyListeners();
  }

  Future<void> updateInterests(List<String> topics) async {
    _profile = await _api.updateInterests(topics);
    notifyListeners();
  }
}
