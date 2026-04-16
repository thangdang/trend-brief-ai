import 'package:flutter/material.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import '../models/feed_item.dart';
import '../services/api_service.dart';
import '../widgets/feed_card.dart';
import '../widgets/topic_chips.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final ApiService _api = ApiService();
  String _selectedTopic = 'all';

  final PagingController<int, FeedItem> _pagingController =
      PagingController(firstPageKey: 1);

  @override
  void initState() {
    super.initState();
    _pagingController.addPageRequestListener(_fetchPage);
  }

  Future<void> _fetchPage(int pageKey) async {
    try {
      final response = await _api.getFeed(
        topic: _selectedTopic == 'all' ? null : _selectedTopic,
        page: pageKey,
      );
      if (response.hasMore) {
        _pagingController.appendPage(response.items, pageKey + 1);
      } else {
        _pagingController.appendLastPage(response.items);
      }
    } catch (e) {
      _pagingController.error = e;
    }
  }

  void _onTopicChanged(String topic) {
    setState(() => _selectedTopic = topic);
    _pagingController.refresh();
  }

  Future<void> _onRefresh() async {
    _pagingController.refresh();
  }

  void _toggleBookmark(FeedItem item) async {
    try {
      if (item.isBookmarked) {
        await _api.removeBookmark(item.id);
      } else {
        await _api.addBookmark(item.id);
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
        TopicChips(
          selectedTopic: _selectedTopic,
          onSelected: _onTopicChanged,
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _onRefresh,
            child: PagedListView<int, FeedItem>(
              pagingController: _pagingController,
              builderDelegate: PagedChildBuilderDelegate<FeedItem>(
                itemBuilder: (context, item, index) => FeedCard(
                  item: item,
                  onBookmarkToggle: () => _toggleBookmark(item),
                ),
                firstPageProgressIndicatorBuilder: (_) =>
                    const Center(child: CircularProgressIndicator()),
                noItemsFoundIndicatorBuilder: (_) => const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Text('Chưa có bài viết nào',
                        style: TextStyle(fontSize: 16, color: Colors.grey)),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
