import 'package:flutter/material.dart';
import '../models/feed_item.dart';
import '../services/api_service.dart';
import '../utils/validators.dart';
import '../widgets/enhanced_feed_card.dart';
import '../widgets/skeleton_card.dart';
import '../widgets/error_state_view.dart';
import 'article_detail_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});
  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _api = ApiService();
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  List<FeedItem> _results = [];
  bool _loading = false;
  bool _hasMore = false;
  int _page = 1;
  String? _error;
  String _lastQuery = '';

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollController.position.extentAfter < 200 && _hasMore && !_loading) {
      _page++;
      _search(append: true);
    }
  }

  Future<void> _search({bool append = false}) async {
    final query = _controller.text.trim();
    if (!isValidSearchQuery(query)) return;

    if (!append) {
      _page = 1;
      _lastQuery = query;
    }

    setState(() { _loading = true; _error = null; });
    try {
      final response = await _api.searchArticles(query: query, page: _page);
      setState(() {
        if (append) {
          _results.addAll(response.items);
        } else {
          _results = response.items;
        }
        _hasMore = response.hasMore;
        _loading = false;
      });
    } catch (_) {
      setState(() { _error = 'Lỗi tìm kiếm'; _loading = false; });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Tìm kiếm bài viết...',
            border: InputBorder.none,
          ),
          onChanged: (v) {
            if (isValidSearchQuery(v)) _search();
          },
        ),
      ),
      body: _error != null
          ? ErrorStateView(message: _error!, onRetry: () => _search())
          : _loading && _results.isEmpty
              ? ListView.builder(itemCount: 3, itemBuilder: (_, __) => const SkeletonCard())
              : _results.isEmpty && _lastQuery.isNotEmpty
                  ? const Center(child: Text('Không tìm thấy kết quả'))
                  : ListView.builder(
                      controller: _scrollController,
                      itemCount: _results.length + (_loading ? 1 : 0),
                      itemBuilder: (_, i) {
                        if (i == _results.length) return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()));
                        final item = _results[i];
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
