import 'package:share_plus/share_plus.dart';
import '../models/feed_item.dart';

class ShareService {
  static const _baseUrl = 'https://trendbriefai.vn';

  static String formatShareText(String title, String url) {
    return '$title\n\nĐọc thêm: $url\n\n— via TrendBrief AI';
  }

  /// Build a rich OG URL that shows a preview card when shared (Task 29.4)
  static String getShareUrl(String articleId) {
    return '$_baseUrl/article/$articleId';
  }

  /// Build Zalo share deep link (Task 29.3)
  static String getZaloShareUrl(String articleId, String title) {
    final url = Uri.encodeComponent(getShareUrl(articleId));
    final encodedTitle = Uri.encodeComponent(title);
    return 'https://zalo.me/share?url=$url&title=$encodedTitle';
  }

  static Future<void> shareArticle(FeedItem item) async {
    final title = item.titleAi.isNotEmpty ? item.titleAi : item.titleOriginal;
    // Use the OG-enabled web URL for rich preview instead of raw source URL
    final shareUrl = getShareUrl(item.id);
    final text = '$title\n\nĐọc thêm: $shareUrl\n\n— via TrendBrief AI';
    await Share.share(text, subject: title);
  }
}
