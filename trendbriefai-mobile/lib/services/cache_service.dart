import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';

class CacheService {
  static const _feedBoxName = 'feed_cache';
  late Box _feedBox;

  Future<void> init() async {
    await Hive.initFlutter();
    _feedBox = await Hive.openBox(_feedBoxName);
  }

  Future<void> cacheFeedPage(String topic, int page, Map<String, dynamic> data) async {
    final key = '${topic}_$page';
    await _feedBox.put(key, jsonEncode(data));
  }

  Map<String, dynamic>? getCachedFeedPage(String topic, int page) {
    final key = '${topic}_$page';
    final raw = _feedBox.get(key);
    if (raw == null) return null;
    return jsonDecode(raw as String) as Map<String, dynamic>;
  }

  Future<void> clearCache() async {
    await _feedBox.clear();
  }
}
