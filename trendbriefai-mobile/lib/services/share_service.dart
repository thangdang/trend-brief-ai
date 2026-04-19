import 'package:share_plus/share_plus.dart';
import '../models/feed_item.dart';

class ShareService {
  static String formatShareText(String title, String url) {
    return '$title\n\nĐọc thêm: $url\n\n— via TrendBrief AI';
  }

  static Future<void> shareArticle(FeedItem item) async {
    final text = formatShareText(
      item.titleAi.isNotEmpty ? item.titleAi : item.titleOriginal,
      item.url,
    );
    await Share.share(text);
  }
}
