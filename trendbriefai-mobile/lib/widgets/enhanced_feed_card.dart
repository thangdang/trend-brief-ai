import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/feed_item.dart';
import '../utils/time_formatter.dart';

class EnhancedFeedCard extends StatefulWidget {
  final FeedItem item;
  final VoidCallback? onBookmarkToggle;
  final VoidCallback? onShare;
  final VoidCallback? onTap;

  const EnhancedFeedCard({
    super.key,
    required this.item,
    this.onBookmarkToggle,
    this.onShare,
    this.onTap,
  });

  @override
  State<EnhancedFeedCard> createState() => _EnhancedFeedCardState();
}

class _EnhancedFeedCardState extends State<EnhancedFeedCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _fadeAnimation;
  double _scale = 1.0;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.05),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _fadeAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeOut),
    );
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  String _topicLabel(String topic) {
    const labels = {
      'ai': 'AI', 'finance': 'Tài chính', 'lifestyle': 'Đời sống',
      'drama': 'Drama', 'career': 'Sự nghiệp', 'technology': 'Công nghệ',
      'health': 'Sức khỏe', 'entertainment': 'Giải trí',
    };
    return labels[topic] ?? topic.toUpperCase();
  }

  Color _topicColor(String topic) {
    const colors = {
      'ai': Colors.blue, 'finance': Colors.green, 'lifestyle': Colors.orange,
      'drama': Colors.red, 'career': Colors.purple, 'technology': Colors.teal,
      'health': Colors.pink, 'entertainment': Colors.amber,
    };
    return colors[topic] ?? Colors.grey;
  }

  IconData _topicIcon(String topic) {
    const icons = {
      'ai': Icons.smart_toy, 'finance': Icons.trending_up,
      'lifestyle': Icons.favorite, 'drama': Icons.theater_comedy,
      'career': Icons.work, 'technology': Icons.computer,
      'health': Icons.health_and_safety, 'entertainment': Icons.movie,
    };
    return icons[topic] ?? Icons.article;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final item = widget.item;

    return SlideTransition(
      position: _slideAnimation,
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: GestureDetector(
          onTapDown: (_) => setState(() => _scale = 0.98),
          onTapUp: (_) { setState(() => _scale = 1.0); widget.onTap?.call(); },
          onTapCancel: () => setState(() => _scale = 1.0),
          child: AnimatedScale(
            scale: _scale,
            duration: const Duration(milliseconds: 100),
            child: Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Thumbnail or gradient placeholder
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                    child: AspectRatio(
                      aspectRatio: 16 / 9,
                      child: item.thumbnailUrl != null
                          ? CachedNetworkImage(
                              imageUrl: item.thumbnailUrl!,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => _gradientPlaceholder(item.topic),
                            )
                          : _gradientPlaceholder(item.topic),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Topic + source + time + trending + actions
                        Row(children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: _topicColor(item.topic).withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(_topicLabel(item.topic),
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _topicColor(item.topic))),
                          ),
                          const SizedBox(width: 8),
                          Expanded(child: Text(
                            '${item.source} · ${formatRelativeTime(item.publishedAt)}',
                            style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey[600]),
                            overflow: TextOverflow.ellipsis,
                          )),
                          Text('⏱ ${item.readingTimeSec}s',
                            style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey[500], fontSize: 11)),
                        ]),
                        if (item.isTrending) ...[
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.orange.shade50,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('🔥 Trending', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.deepOrange)),
                          ),
                        ],
                        const SizedBox(height: 10),
                        // Title
                        Text(
                          item.titleAi.isNotEmpty ? item.titleAi : item.titleOriginal,
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          maxLines: 2, overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 10),
                        // Bullets
                        ...item.summaryBullets.map((b) => Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Text('• ', style: TextStyle(fontSize: 14)),
                            Expanded(child: Text(b, style: theme.textTheme.bodyMedium, maxLines: 2, overflow: TextOverflow.ellipsis)),
                          ]),
                        )),
                        const SizedBox(height: 8),
                        // Actions row
                        Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                          IconButton(
                            icon: const Icon(Icons.share_outlined, size: 20),
                            onPressed: widget.onShare,
                            color: theme.colorScheme.primary,
                          ),
                          IconButton(
                            icon: Icon(
                              item.isBookmarked ? Icons.bookmark : Icons.bookmark_border,
                              color: item.isBookmarked ? theme.colorScheme.primary : Colors.grey,
                            ),
                            onPressed: () {
                              HapticFeedback.lightImpact();
                              widget.onBookmarkToggle?.call();
                            },
                          ),
                        ]),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _gradientPlaceholder(String topic) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [_topicColor(topic).withOpacity(0.7), _topicColor(topic).withOpacity(0.3)],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
      ),
      child: Center(child: Icon(_topicIcon(topic), size: 48, color: Colors.white70)),
    );
  }
}
