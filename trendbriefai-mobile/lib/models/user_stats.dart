class UserStats {
  final int totalArticlesRead;
  final int totalBookmarks;
  final int daysActive;
  final int streakCount;

  UserStats({
    required this.totalArticlesRead,
    required this.totalBookmarks,
    required this.daysActive,
    required this.streakCount,
  });

  factory UserStats.fromJson(Map<String, dynamic> json) {
    return UserStats(
      totalArticlesRead: json['totalArticlesRead'] as int? ?? 0,
      totalBookmarks: json['totalBookmarks'] as int? ?? 0,
      daysActive: json['daysActive'] as int? ?? 0,
      streakCount: json['streakCount'] as int? ?? 0,
    );
  }
}
