class UserStats {
  final int totalArticlesRead;
  final int totalBookmarks;
  final int daysActive;

  UserStats({
    required this.totalArticlesRead,
    required this.totalBookmarks,
    required this.daysActive,
  });

  factory UserStats.fromJson(Map<String, dynamic> json) {
    return UserStats(
      totalArticlesRead: json['totalArticlesRead'] as int? ?? 0,
      totalBookmarks: json['totalBookmarks'] as int? ?? 0,
      daysActive: json['daysActive'] as int? ?? 0,
    );
  }
}
