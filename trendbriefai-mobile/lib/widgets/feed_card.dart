import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/feed_item.dart';

class FeedCard extends StatelessWidget {
  final FeedItem item;
  final VoidCallback? onBookmarkToggle;
  final VoidCallback? onShare;

  const FeedCard({
    super.key,
    required this.item,
    this.onBookmarkToggle,
    this.onShare,
  });

  String _topicLabel(String topic) {
    switch (topic) {
      case 'ai':
        return 'AI';
      case 'finance':
        return 'Tài chính';
      case 'lifestyle':
        return 'Đời sống';
      case 'drama':
        return 'Drama';
      default:
        return topic.toUpperCase();
    }
  }

  Color _topicColor(String topic) {
    switch (topic) {
      case 'ai':
        return Colors.blue;
      case 'finance':
        return Colors.green;
      case 'lifestyle':
        return Colors.orange;
      case 'drama':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  Future<void> _openUrl() async {
    final uri = Uri.parse(item.url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Topic chip + source + bookmark
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _topicColor(item.topic).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _topicLabel(item.topic),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _topicColor(item.topic),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(item.source,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: Colors.grey[600])),
                const Spacer(),
                Text('⏱ ${item.readingTimeSec}s',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: Colors.grey[500], fontSize: 11)),
                const SizedBox(width: 4),
                IconButton(
                  icon: const Icon(Icons.share_outlined, size: 20),
                  onPressed: onShare,
                  color: theme.colorScheme.primary,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
                const SizedBox(width: 4),
                IconButton(
                  icon: Icon(
                    item.isBookmarked
                        ? Icons.bookmark
                        : Icons.bookmark_border,
                    color: item.isBookmarked
                        ? theme.colorScheme.primary
                        : Colors.grey,
                  ),
                  onPressed: onBookmarkToggle,
                  iconSize: 22,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Thumbnail image
            if (item.thumbnailUrl != null && item.thumbnailUrl!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    item.thumbnailUrl!,
                    width: double.infinity,
                    height: 180,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                    loadingBuilder: (context, child, progress) {
                      if (progress == null) return child;
                      return Container(
                        width: double.infinity,
                        height: 180,
                        color: Colors.grey[200],
                        child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                      );
                    },
                  ),
                ),
              ),
            // AI title
            Text(
              item.titleAi.isNotEmpty ? item.titleAi : item.titleOriginal,
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 10),
            // 3 bullet points
            ...item.summaryBullets.map((bullet) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('• ', style: TextStyle(fontSize: 14)),
                      Expanded(
                        child: Text(bullet,
                            style: theme.textTheme.bodyMedium,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis),
                      ),
                    ],
                  ),
                )),
            const SizedBox(height: 8),
            // Reason
            if (item.reason.isNotEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '💡 ${item.reason}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontStyle: FontStyle.italic,
                    color: theme.colorScheme.onPrimaryContainer,
                  ),
                ),
              ),
            const SizedBox(height: 10),
            // Read full button
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: _openUrl,
                icon: const Icon(Icons.open_in_new, size: 16),
                label: const Text('Đọc full'),
                style: TextButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
