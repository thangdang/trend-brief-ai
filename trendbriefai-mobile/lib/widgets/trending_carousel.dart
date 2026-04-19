import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/feed_item.dart';
import '../utils/time_formatter.dart';

class TrendingCarousel extends StatelessWidget {
  final List<FeedItem> items;
  final ValueChanged<FeedItem> onTap;

  const TrendingCarousel({super.key, required this.items, required this.onTap});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Text('🔥 Trending', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        ),
        SizedBox(
          height: 180,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: items.length,
            itemBuilder: (_, i) {
              final item = items[i];
              return GestureDetector(
                onTap: () => onTap(item),
                child: Container(
                  width: 260,
                  margin: const EdgeInsets.only(right: 12),
                  child: Card(
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: item.thumbnailUrl != null
                              ? CachedNetworkImage(imageUrl: item.thumbnailUrl!, fit: BoxFit.cover, width: double.infinity)
                              : Container(
                                  color: Colors.indigo.withOpacity(0.2),
                                  child: const Center(child: Icon(Icons.trending_up, size: 32, color: Colors.indigo)),
                                ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.titleAi.isNotEmpty ? item.titleAi : item.titleOriginal,
                                maxLines: 2, overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${item.source} · ${formatRelativeTime(item.publishedAt)}',
                                style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey[600]),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
