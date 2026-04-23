import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import '../models/feed_item.dart';
import '../services/api_service.dart';
import '../services/analytics_service.dart';
import '../services/share_service.dart';
import '../services/cache_service.dart';
import '../widgets/enhanced_feed_card.dart';
import '../widgets/dynamic_topic_chips.dart';
import '../widgets/trending_carousel.dart';
import '../widgets/skeleton_card.dart';
import '../widgets/error_state_view.dart';
import 'article_detail_screen.dart';
import 'search_screen.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});
  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final ApiService _api = ApiService();
  final AnalyticsService _analytics = AnalyticsService();
  final CacheService _cache = CacheService();
  String _selectedTopic = 'all';
  List<FeedItem> _trending = [];
  bool _isOffline = false;

  final PagingController<int, FeedItem> _pagingController =
      PagingController(firstPageKey: 1);

  @override
  void initState() {
    super.initState();
    _pagingController.addPageRequestListener(_fetchPage);
    _loadTrending();
    _checkConnectivity();
  }

  Future<void> _checkConnectivity() async {
    Connectivity().onConnectivityChanged.listen((results) {
      final offline = results.every((r) => r == ConnectivityResult.none);
      if (mounted) setState(() => _isOffline = offline);
    });
  }

  Future<void> _loadTrending() async {
    try {
      final items = await _api.getTrending(limit: 10);
      if (mounted) setState(() => _trending = items);
    } catch (_) {
      // Silently hide trending on failure
    }
  }

  Future<void> _fetchPage(int pageKey) async {
    try {
      final response = await _api.getFeed(
        topic: _selectedTopic == 'all' ? null : _selectedTopic,
        page: pageKey,
      );
      // Cache first page
      if (pageKey == 1) {
        _cache.cacheFeedPage(_selectedTopic, 1, {
          'items': response.items.map((e) => e.toJson()).toList(),
          'hasMore': response.hasMore,
        }).catchError((_) {});
      }
      if (response.hasMore) {
        _pagingController.appendPage(response.items, pageKey + 1);
      } else {
        _pagingController.appendLastPage(response.items);
      }
    } catch (e) {
      // Try cache on failure
      if (pageKey == 1) {
        final cached = _cache.getCachedFeedPage(_selectedTopic, 1);
        if (cached != null) {
          final items = (cached['items'] as List).map((e) => FeedItem.fromJson(e)).toList();
          _pagingController.appendLastPage(items);
          return;
        }
      }
      _pagingController.error = e;
    }
  }

  void _onTopicChanged(String topic) {
    setState(() => _selectedTopic = topic);
    _pagingController.refresh();
  }

  Future<void> _onRefresh() async {
    HapticFeedback.mediumImpact();
    _loadTrending();
    _pagingController.refresh();
  }

  void _toggleBookmark(FeedItem item) async {
    try {
      if (item.isBookmarked) {
        await _api.removeBookmark(item.id);
      } else {
        await _api.addBookmark(item.id);
        _analytics.logBookmarkAdd(item.id, item.topic);
      }
      setState(() => item.isBookmarked = !item.isBookmarked);
    } catch (_) {}
  }

  @override
  void dispose() {
    _pagingController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_isOffline)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 6),
            color: Colors.red.shade700,
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.wifi_off, color: Colors.white, size: 16),
                SizedBox(width: 8),
                Text('Không có kết nối mạng', style: TextStyle(color: Colors.white, fontSize: 13)),
              ],
            ),
          ),
        DynamicTopicChips(
          selectedTopic: _selectedTopic,
          onSelected: _onTopicChanged,
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _onRefresh,
            child: CustomScrollView(
              slivers: [
                if (_trending.isNotEmpty)
                  SliverToBoxAdapter(
                    child: TrendingCarousel(
                      items: _trending,
                      onTap: (item) => Navigator.push(context, MaterialPageRoute(
                        builder: (_) => ArticleDetailScreen(articleId: item.id, preloaded: item),
                      )),
                    ),
                  ),
                PagedSliverList<int, FeedItem>(
                  pagingController: _pagingController,
                  builderDelegate: PagedChildBuilderDelegate<FeedItem>(
                    itemBuilder: (context, item, index) => EnhancedFeedCard(
                      item: item,
                      onBookmarkToggle: () => _toggleBookmark(item),
                      onShare: () async {
                        await ShareService.shareArticle(item);
                        _api.trackShare(item.id).catchError((_) {});
                        _analytics.logArticleShare(item.id, item.topic);
                      },
                      onTap: () => Navigator.push(context, MaterialPageRoute(
                        builder: (_) => ArticleDetailScreen(articleId: item.id, preloaded: item),
                      )),
                    ),
                    firstPageProgressIndicatorBuilder: (_) =>
                        Column(children: List.generate(3, (_) => const SkeletonCard())),
                    firstPageErrorIndicatorBuilder: (_) => ErrorStateView(
                      message: 'Không thể tải bảng tin',
                      onRetry: () => _pagingController.refresh(),
                      showOfflineBanner: _isOffline,
                    ),
                    noItemsFoundIndicatorBuilder: (_) => const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: Text('Chưa có bài viết nào', style: TextStyle(fontSize: 16, color: Colors.grey)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
