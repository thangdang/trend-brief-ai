import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../models/feed_item.dart';

/// Local SQLite cache for offline reading.
/// Caches last 50 articles + pending bookmark syncs.
class CacheService {
  static Database? _db;
  static const int _maxCachedArticles = 50;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDb();
    return _db!;
  }

  Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'trendbriefai_cache.db');

    return openDatabase(path, version: 1, onCreate: (db, version) async {
      await db.execute('''
        CREATE TABLE articles (
          id TEXT PRIMARY KEY,
          title_ai TEXT,
          title_original TEXT,
          summary_bullets TEXT,
          reason TEXT,
          url TEXT,
          topic TEXT,
          source TEXT,
          image_url TEXT,
          published_at TEXT,
          cached_at INTEGER
        )
      ''');
      await db.execute('''
        CREATE TABLE pending_bookmarks (
          article_id TEXT PRIMARY KEY,
          action TEXT,
          created_at INTEGER
        )
      ''');
    });
  }

  /// Cache articles from API response (keep last 50).
  Future<void> cacheArticles(List<FeedItem> articles) async {
    final db = await database;
    final batch = db.batch();

    for (final a in articles.take(_maxCachedArticles)) {
      batch.insert('articles', {
        'id': a.id,
        'title_ai': a.titleAi,
        'title_original': a.titleOriginal,
        'summary_bullets': a.summaryBullets.join('|||'),
        'reason': a.reason,
        'url': a.url,
        'topic': a.topic,
        'source': a.source,
        'image_url': a.imageUrl ?? '',
        'published_at': a.publishedAt,
        'cached_at': DateTime.now().millisecondsSinceEpoch,
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }

    await batch.commit(noResult: true);

    // Trim to max cached articles
    await db.execute('''
      DELETE FROM articles WHERE id NOT IN (
        SELECT id FROM articles ORDER BY cached_at DESC LIMIT $_maxCachedArticles
      )
    ''');
  }

  /// Get cached articles for offline reading.
  Future<List<FeedItem>> getCachedArticles({String? topic}) async {
    final db = await database;
    final where = topic != null ? 'topic = ?' : null;
    final whereArgs = topic != null ? [topic] : null;

    final rows = await db.query('articles',
        where: where, whereArgs: whereArgs,
        orderBy: 'cached_at DESC', limit: _maxCachedArticles);

    return rows.map((row) => FeedItem(
      id: row['id'] as String,
      titleAi: row['title_ai'] as String? ?? '',
      titleOriginal: row['title_original'] as String? ?? '',
      summaryBullets: (row['summary_bullets'] as String? ?? '').split('|||'),
      reason: row['reason'] as String? ?? '',
      url: row['url'] as String? ?? '',
      topic: row['topic'] as String? ?? 'ai',
      source: row['source'] as String? ?? '',
      imageUrl: (row['image_url'] as String?)?.isNotEmpty == true ? row['image_url'] as String : null,
      publishedAt: row['published_at'] as String? ?? '',
      isBookmarked: false,
      readingTimeSec: 30,
    )).toList();
  }

  /// Save a pending bookmark for offline sync.
  Future<void> addPendingBookmark(String articleId) async {
    final db = await database;
    await db.insert('pending_bookmarks', {
      'article_id': articleId,
      'action': 'add',
      'created_at': DateTime.now().millisecondsSinceEpoch,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  /// Get all pending bookmarks for sync.
  Future<List<Map<String, dynamic>>> getPendingBookmarks() async {
    final db = await database;
    return db.query('pending_bookmarks');
  }

  /// Clear synced bookmarks.
  Future<void> clearPendingBookmarks() async {
    final db = await database;
    await db.delete('pending_bookmarks');
  }

  /// Check if device is online.
  Future<bool> isOnline() async {
    final result = await Connectivity().checkConnectivity();
    return result != ConnectivityResult.none;
  }
}
