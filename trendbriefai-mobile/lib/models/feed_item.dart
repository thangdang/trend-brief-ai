class FeedItem {
  final String id;
  final String titleOriginal;
  final String titleAi;
  final List<String> summaryBullets;
  final String reason;
  final String url;
  final String topic;
  final String source;
  final String publishedAt;
  bool isBookmarked;
  final String createdAt;
  final int readingTimeSec;
  final String? thumbnailUrl;
  final bool isTrending;

  FeedItem({
    required this.id,
    required this.titleOriginal,
    required this.titleAi,
    required this.summaryBullets,
    required this.reason,
    required this.url,
    required this.topic,
    required this.source,
    required this.publishedAt,
    required this.isBookmarked,
    required this.createdAt,
    required this.readingTimeSec,
    this.thumbnailUrl,
    this.isTrending = false,
  });

  factory FeedItem.fromJson(Map<String, dynamic> json) {
    return FeedItem(
      id: json['id'] as String,
      titleOriginal: json['titleOriginal'] as String? ?? '',
      titleAi: json['titleAi'] as String? ?? '',
      summaryBullets: List<String>.from(json['summaryBullets'] ?? []),
      reason: json['reason'] as String? ?? '',
      url: json['url'] as String,
      topic: json['topic'] as String? ?? 'ai',
      source: json['source'] as String? ?? '',
      publishedAt: json['publishedAt'] as String? ?? '',
      isBookmarked: json['isBookmarked'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? '',
      readingTimeSec: json['readingTimeSec'] as int? ?? 30,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      isTrending: json['isTrending'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'titleOriginal': titleOriginal,
      'titleAi': titleAi,
      'summaryBullets': summaryBullets,
      'reason': reason,
      'url': url,
      'topic': topic,
      'source': source,
      'publishedAt': publishedAt,
      'isBookmarked': isBookmarked,
      'createdAt': createdAt,
      'readingTimeSec': readingTimeSec,
      'thumbnailUrl': thumbnailUrl,
      'isTrending': isTrending,
    };
  }
}

class FeedResponse {
  final List<FeedItem> items;
  final int page;
  final int totalPages;
  final bool hasMore;

  FeedResponse({
    required this.items,
    required this.page,
    required this.totalPages,
    required this.hasMore,
  });

  factory FeedResponse.fromJson(Map<String, dynamic> json) {
    return FeedResponse(
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => FeedItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      page: json['page'] as int? ?? 1,
      totalPages: json['totalPages'] as int? ?? 1,
      hasMore: json['hasMore'] as bool? ?? false,
    );
  }
}
