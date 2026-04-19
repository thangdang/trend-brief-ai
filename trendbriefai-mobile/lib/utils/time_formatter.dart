String formatRelativeTime(String isoTimestamp) {
  if (isoTimestamp.isEmpty) return '';
  try {
    final date = DateTime.parse(isoTimestamp);
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inSeconds < 60) return 'vừa xong';
    if (diff.inMinutes < 60) return '${diff.inMinutes} phút trước';
    if (diff.inHours < 24) return '${diff.inHours} giờ trước';
    if (diff.inDays < 7) return '${diff.inDays} ngày trước';
    if (diff.inDays < 30) return '${diff.inDays ~/ 7} tuần trước';
    return '${diff.inDays ~/ 30} tháng trước';
  } catch (_) {
    return '';
  }
}
