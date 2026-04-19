import 'package:flutter/material.dart';
import '../models/feed_item.dart';
import '../services/api_service.dart';
import '../widgets/enhanced_feed_card.dart';
import '../widgets/error_state_view.dart';
import '../widgets/skeleton_card.dart';
import 'article_detail_screen.dart';

class BookmarksScreen extends StatefulWidget {
  const BookmarksScreen({super.key});
  @override
  State<BookmarksScreen> createState() => _BookmarksScreenState();
}

class _BookmarksScreenState extends State<BookmarksScreen> {
  final ApiService _api = ApiService();
  List<FeedItem> _items = [];
  bool _loading = true;
  int _page = 1;
  bool _hasMore = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadBookmarks();
  }

  Future<void> _loadBookmarks({bool refresh = false}) async {
    if (refresh) setState(() { _page = 1; _hasMore = true; _loading = true; _error = null; });
    try {
      final response = await _api.getBookmarks(page: _page);
      setState(() {
        if (refresh || _page == 1) {
          _items = response.items;
        } else {
          _items.addAll(response.items);
        }
        _hasMore = response.hasMore;
        _loading = false;
      });
    } catch (_) {
      setState(() { _loading = false; _error = 'Không thể tải bookmark'; });
    }
  }

  Future<void> _removeBookmark(FeedItem item) async {
    try {
      await _api.removeBookmark(item.id);
      setState(() => _items.removeWhere((i) => i.id == item.id));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null && _items.isEmpty) {
      return ErrorStateView(message: _error!, onRetry: () => _loadBookmarks(refresh: true));
    }

    if (_loading && _items.isEmpty) {
      return ListView.builder(itemCount: 3, itemBuilder: (_, __) => const SkeletonCard());
    }

    if (_items.isEmpty) {
      return const Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.bookmark_border, size: 64, color: Colors.grey),
          SizedBox(height: 16),
          Text('Chưa có bookmark nào', style: TextStyle(fontSize: 16, color: Colors.grey)),
        ]),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _loadBookmarks(refresh: true),
      child: ListView.builder(
        itemCount: _items.length,
        itemBuilder: (context, index) {
          final item = _items[index];
          return Dismissible(
            key: Key(item.id),
            direction: DismissDirection.endToStart,
            background: Container(
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.only(right: 20),
              color: Colors.red,
              child: const Icon(Icons.delete, color: Colors.white),
            ),
            onDismissed: (_) => _removeBookmark(item),
            child: EnhancedFeedCard(
              item: item,
              onBookmarkToggle: () => _removeBookmark(item),
              onTap: () => Navigator.push(context, MaterialPageRoute(
                builder: (_) => ArticleDetailScreen(articleId: item.id, preloaded: item),
              )),
            ),
          );
        },
      ),
    );
  }
}
