import 'package:flutter/material.dart';
import '../models/feed_item.dart';
import '../services/api_service.dart';
import '../widgets/enhanced_feed_card.dart';
import '../widgets/skeleton_card.dart';
import '../widgets/error_state_view.dart';
import 'article_detail_screen.dart';

class ReadingHistoryScreen extends StatefulWidget {
  const ReadingHistoryScreen({super.key});
  @override
  State<ReadingHistoryScreen> createState() => _ReadingHistoryScreenState();
}

class _ReadingHistoryScreenState extends State<ReadingHistoryScreen> {
  final _api = ApiService();
  final _scrollController = ScrollController();
  List<FeedItem> _items = [];
  bool _loading = true;
  bool _hasMore = false;
  int _page = 1;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _load();
  }

  void _onScroll() {
    if (_scrollController.position.extentAfter < 200 && _hasMore && !_loading) {
      _page++;
      _load(append: true);
    }
  }

  Future<void> _load({bool append = false}) async {
    if (!append) setState(() { _loading = true; _error = null; });
    try {
      final response = await _api.getReadingHistory(page: _page);
      setState(() {
        if (append) {
          _items.addAll(response.items);
        } else {
          _items = response.items;
        }
        _hasMore = response.hasMore;
        _loading = false;
      });
    } catch (_) {
      setState(() { _error = 'Không thể tải lịch sử'; _loading = false; });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lịch sử đọc')),
      body: _error != null
          ? ErrorStateView(message: _error!, onRetry: () { _page = 1; _load(); })
          : _loading && _items.isEmpty
              ? ListView.builder(itemCount: 3, itemBuilder: (_, __) => const SkeletonCard())
              : _items.isEmpty
                  ? const Center(child: Text('Chưa đọc bài viết nào'))
                  : ListView.builder(
                      controller: _scrollController,
                      itemCount: _items.length + (_loading ? 1 : 0),
                      itemBuilder: (_, i) {
                        if (i == _items.length) return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()));
                        final item = _items[i];
                        return EnhancedFeedCard(
                          item: item,
                          onTap: () => Navigator.push(context, MaterialPageRoute(
                            builder: (_) => ArticleDetailScreen(articleId: item.id, preloaded: item),
                          )),
                        );
                      },
                    ),
    );
  }
}
