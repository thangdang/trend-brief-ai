import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/api_config.dart';
import '../models/auth_tokens.dart';
import '../models/feed_item.dart';
import '../models/user_profile.dart';

class ApiService {
  late final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';

  ApiService() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: ApiConfig.connectTimeout,
      receiveTimeout: ApiConfig.receiveTimeout,
      headers: {'Content-Type': 'application/json'},
    ));
    _dio.interceptors.add(_authInterceptor());
  }

  Interceptor _authInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: _accessTokenKey);
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          try {
            final newTokens = await _refreshToken();
            if (newTokens != null) {
              await _saveTokens(newTokens);
              final opts = error.requestOptions;
              opts.headers['Authorization'] =
                  'Bearer ${newTokens.accessToken}';
              final response = await _dio.fetch(opts);
              return handler.resolve(response);
            }
          } catch (_) {}
        }
        handler.next(error);
      },
    );
  }

  // --- Token helpers ---

  Future<void> _saveTokens(AuthTokens tokens) async {
    await _storage.write(key: _accessTokenKey, value: tokens.accessToken);
    await _storage.write(key: _refreshTokenKey, value: tokens.refreshToken);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }

  Future<bool> hasToken() async {
    final token = await _storage.read(key: _accessTokenKey);
    return token != null;
  }

  Future<AuthTokens?> _refreshToken() async {
    final refreshToken = await _storage.read(key: _refreshTokenKey);
    if (refreshToken == null) return null;
    final response = await Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      headers: {'Content-Type': 'application/json'},
    )).post('/auth/refresh', data: {'refreshToken': refreshToken});
    return AuthTokens.fromJson(response.data);
  }

  // --- Auth ---

  Future<AuthTokens> login(String email, String password) async {
    final response = await _dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    final tokens = AuthTokens.fromJson(response.data);
    await _saveTokens(tokens);
    return tokens;
  }

  Future<AuthTokens> register(String email, String password) async {
    final response = await _dio.post('/auth/register', data: {
      'email': email,
      'password': password,
    });
    final tokens = AuthTokens.fromJson(response.data);
    await _saveTokens(tokens);
    return tokens;
  }

  Future<void> logout() async {
    await clearTokens();
  }

  // --- Feed ---

  Future<FeedResponse> getFeed({String? topic, int page = 1, int limit = 20}) async {
    final params = <String, dynamic>{'page': page, 'limit': limit};
    if (topic != null) params['topic'] = topic;
    final response = await _dio.get('/feed', queryParameters: params);
    return FeedResponse.fromJson(response.data);
  }

  Future<FeedItem> getArticle(String id) async {
    final response = await _dio.get('/articles/$id');
    return FeedItem.fromJson(response.data);
  }

  // --- Bookmarks ---

  Future<void> addBookmark(String articleId) async {
    await _dio.post('/bookmarks', data: {'articleId': articleId});
  }

  Future<void> removeBookmark(String bookmarkId) async {
    await _dio.delete('/bookmarks/$bookmarkId');
  }

  Future<FeedResponse> getBookmarks({int page = 1}) async {
    final response =
        await _dio.get('/bookmarks', queryParameters: {'page': page});
    return FeedResponse.fromJson(response.data);
  }

  // --- Search ---

  Future<FeedResponse> searchArticles({required String query, String? topic, int page = 1}) async {
    final params = <String, dynamic>{'q': query, 'page': page};
    if (topic != null) params['topic'] = topic;
    final response = await _dio.get('/search', queryParameters: params);
    return FeedResponse.fromJson(response.data);
  }

  // --- Trending ---

  Future<List<FeedItem>> getTrending({int limit = 10}) async {
    final response = await _dio.get('/trending', queryParameters: {'limit': limit});
    final items = (response.data['items'] as List<dynamic>?)
        ?.map((e) => FeedItem.fromJson(e as Map<String, dynamic>))
        .toList() ?? [];
    return items;
  }

  // --- Interactions ---

  Future<void> trackInteraction(String articleId, String action) async {
    await _dio.post('/interactions', data: {
      'articleId': articleId,
      'action': action,
    });
  }

  // --- User ---

  Future<UserProfile> getProfile() async {
    final response = await _dio.get('/users/me');
    return UserProfile.fromJson(response.data);
  }

  Future<UserProfile> updateInterests(List<String> topics) async {
    final response =
        await _dio.put('/users/interests', data: {'interests': topics});
    return UserProfile.fromJson(response.data);
  }

  // --- Topics ---

  Future<List<Map<String, dynamic>>> getTopics() async {
    final response = await _dio.get('/topics');
    return List<Map<String, dynamic>>.from(response.data);
  }

  // --- User Stats ---

  Future<Map<String, dynamic>> getUserStats() async {
    final response = await _dio.get('/users/me/stats');
    return Map<String, dynamic>.from(response.data);
  }

  // --- Reading History ---

  Future<FeedResponse> getReadingHistory({int page = 1}) async {
    final response = await _dio.get('/users/me/history', queryParameters: {'page': page});
    return FeedResponse.fromJson(response.data);
  }

  // --- Onboarding ---

  Future<void> saveOnboarding(List<String> interests) async {
    await _dio.post('/users/me/onboarding', data: {'interests': interests});
  }

  // --- Notifications ---

  Future<void> registerDeviceToken(String token, String platform) async {
    await _dio.post('/notifications/register', data: {'token': token, 'platform': platform});
  }

  Future<void> unregisterDeviceToken(String token) async {
    await _dio.delete('/notifications/unregister', data: {'token': token});
  }

  // --- Settings ---

  Future<void> updateSettings(Map<String, dynamic> settings) async {
    await _dio.put('/users/me/settings', data: settings);
  }

  // --- Share tracking ---

  Future<void> trackShare(String articleId) async {
    await trackInteraction(articleId, 'share');
  }

  // --- Report ---

  Future<void> reportArticle(String articleId, String reason) async {
    await _dio.post('/articles/$articleId/report', data: {'reason': reason});
  }

  // --- Referral ---

  Future<Map<String, dynamic>> getReferralCode() async {
    final response = await _dio.get('/referral/code');
    return Map<String, dynamic>.from(response.data);
  }
}
