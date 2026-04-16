import 'package:flutter/material.dart';
import '../models/feed_item.dart';
import '../services/api_service.dart';
import '../widgets/feed_card.dart';

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

  @override
  void initState() {
    super.initState();
    _loadBookmarks();
  }

  Future<void> _loadBookmarks({bool refresh = false}) async {
    if (refresh) {
      setState(() { _page = 1; _hasMore = true; _loading = true; });
    }
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
      setState(() => _loading = false);
    }
  }

  Future<void> _removeBookmark(FeedItem item) async {
    try {
      await _api.removeBookmark(item.id);
      setState(() => _items.removeWhere((i) => i.id == item.id));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã xóa bookmark')),
        );
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_items.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.bookmark_border, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text('Chưa có bookmark nào',
                style: TextStyle(fontSize: 16, color: Colors.grey)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _loadBookmarks(refresh: true),
      child: NotificationListener<ScrollNotification>(
        onNotification: (notification) {
          if (notification is ScrollEndNotification &&
              notification.metrics.extentAfter < 200 &&
              _hasMore &&
              !_loading) {
            _page++;
            _loadBookmarks();
          }
          return false;
        },
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
              child: FeedCard(
                item: item,
                onBookmarkToggle: () => _removeBookmark(item),
              ),
            );
          },
        ),
      ),
    );
  }
}
