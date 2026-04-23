import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/feed_item.dart';
import '../services/api_service.dart';
import '../services/analytics_service.dart';
import '../services/share_service.dart';
import '../services/review_prompt_service.dart';
import '../utils/time_formatter.dart';
import '../widgets/skeleton_detail_view.dart';

class ArticleDetailScreen extends StatefulWidget {
  final String articleId;
  final FeedItem? preloaded;

  const ArticleDetailScreen({super.key, required this.articleId, this.preloaded});

  @override
  State<ArticleDetailScreen> createState() => _ArticleDetailScreenState();
}

class _ArticleDetailScreenState extends State<ArticleDetailScreen> {
  final _api = ApiService();
  final _analytics = AnalyticsService();
  final _reviewService = ReviewPromptService();
  FeedItem? _item;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    if (widget.preloaded != null) {
      _item = widget.preloaded;
      _loading = false;
    }
    _loadAndTrack();
  }

  Future<void> _loadAndTrack() async {
    // Track view
    _api.trackInteraction(widget.articleId, 'view').catchError((_) {});
    _reviewService.incrementArticlesViewed();

    // Log article_view analytics event
    final topic = _item?.topic ?? '';
    if (topic.isNotEmpty) {
      _analytics.logArticleView(widget.articleId, topic);
    }

    if (_item == null) {
      try {
        final item = await _api.getArticle(widget.articleId);
        if (mounted) setState(() { _item = item; _loading = false; });
        // Log with resolved topic if we didn't have it before
        if (topic.isEmpty && item.topic.isNotEmpty) {
          _analytics.logArticleView(widget.articleId, item.topic);
        }
      } catch (_) {
        if (mounted) setState(() => _loading = false);
      }
    }
  }

  @override
  void dispose() {
    _reviewService.checkAndPrompt();
    super.dispose();
  }

  void _showReportDialog() {
    final reasons = [
      'Nội dung spam / quảng cáo',
      'Thông tin sai lệch',
      'Nội dung không phù hợp',
      'Vi phạm bản quyền',
      'Khác',
    ];
    showDialog(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Báo cáo bài viết'),
        children: reasons.map((r) => SimpleDialogOption(
          onPressed: () async {
            Navigator.pop(ctx);
            try {
              await _api.reportArticle(_item!.id, r);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Báo cáo đã được ghi nhận')),
                );
              }
            } catch (_) {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Không thể gửi báo cáo')),
                );
              }
            }
          },
          child: Text(r),
        )).toList(),
      ),
    );
  }

  Color _topicColor(String topic) {
    const colors = {
      'ai': Colors.blue, 'finance': Colors.green, 'lifestyle': Colors.orange,
      'drama': Colors.red, 'career': Colors.purple, 'technology': Colors.teal,
      'health': Colors.pink, 'entertainment': Colors.amber,
    };
    return colors[topic] ?? Colors.grey;
  }

  String _topicLabel(String topic) {
    const labels = {
      'ai': 'AI', 'finance': 'Tài chính', 'lifestyle': 'Đời sống',
      'drama': 'Drama', 'career': 'Sự nghiệp', 'technology': 'Công nghệ',
      'health': 'Sức khỏe', 'entertainment': 'Giải trí',
    };
    return labels[topic] ?? topic.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        actions: [
          if (_item != null) ...[
            IconButton(
              icon: Icon(_item!.isBookmarked ? Icons.bookmark : Icons.bookmark_border),
              onPressed: () async {
                try {
                  if (_item!.isBookmarked) {
                    await _api.removeBookmark(_item!.id);
                  } else {
                    await _api.addBookmark(_item!.id);
                    _analytics.logBookmarkAdd(_item!.id, _item!.topic);
                  }
                  setState(() => _item!.isBookmarked = !_item!.isBookmarked);
                } catch (_) {}
              },
            ),
            IconButton(
              icon: const Icon(Icons.share),
              onPressed: () async {
                await ShareService.shareArticle(_item!);
                _api.trackShare(_item!.id).catchError((_) {});
                _analytics.logArticleShare(_item!.id, _item!.topic);
              },
            ),
          ],
        ],
      ),
      body: _loading
          ? const SkeletonDetailView()
          : _item == null
              ? const Center(child: Text('Không tìm thấy bài viết'))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Topic badge + source
                      Row(children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: _topicColor(_item!.topic).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(_topicLabel(_item!.topic),
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _topicColor(_item!.topic))),
                        ),
                        const SizedBox(width: 8),
                        Text(_item!.source, style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey[600])),
                      ]),
                      const SizedBox(height: 16),
                      // Title
                      Text(
                        _item!.titleAi.isNotEmpty ? _item!.titleAi : _item!.titleOriginal,
                        style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      // Thumbnail image
                      if (_item!.thumbnailUrl != null && _item!.thumbnailUrl!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.network(
                              _item!.thumbnailUrl!,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                            ),
                          ),
                        ),
                      // Date + reading time
                      Text(
                        '${formatRelativeTime(_item!.publishedAt)} · ⏱ ${_item!.readingTimeSec}s đọc',
                        style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 24),
                      // Summary bullets
                      ...(_item!.summaryBullets.map((b) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Text('• ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                          Expanded(child: Text(b, style: theme.textTheme.bodyLarge)),
                        ]),
                      ))),
                      // Reason
                      if (_item!.reason.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.primaryContainer.withOpacity(0.3),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text('💡 ${_item!.reason}',
                            style: theme.textTheme.bodyMedium?.copyWith(fontStyle: FontStyle.italic)),
                        ),
                      ],
                      const SizedBox(height: 24),
                      // Read original button
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () async {
                            final uri = Uri.parse(_item!.url);
                            if (await canLaunchUrl(uri)) {
                              await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
                              _api.trackInteraction(_item!.id, 'click_original').catchError((_) {});
                            }
                          },
                          icon: const Icon(Icons.open_in_new),
                          label: const Text('Đọc bài gốc'),
                        ),
                      ),
                      const SizedBox(height: 12),
                      // Report button (Task 28.3)
                      SizedBox(
                        width: double.infinity,
                        child: TextButton.icon(
                          onPressed: () => _showReportDialog(),
                          icon: Icon(Icons.flag_outlined, color: Colors.grey[600], size: 18),
                          label: Text('Báo cáo bài viết', style: TextStyle(color: Colors.grey[600])),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
