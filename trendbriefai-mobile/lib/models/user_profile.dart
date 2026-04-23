class NotificationPrefs {
  final bool trending;
  final bool topic;
  final bool daily;
  final bool weekly;

  NotificationPrefs({
    this.trending = true,
    this.topic = true,
    this.daily = true,
    this.weekly = true,
  });

  factory NotificationPrefs.fromJson(Map<String, dynamic>? json) {
    if (json == null) return NotificationPrefs();
    return NotificationPrefs(
      trending: json['trending'] ?? true,
      topic: json['topic'] ?? true,
      daily: json['daily'] ?? true,
      weekly: json['weekly'] ?? true,
    );
  }
}

class UserProfile {
  final String id;
  final String email;
  final List<String> interests;
  final bool notificationsEnabled;
  final NotificationPrefs notificationPrefs;
  final String createdAt;

  UserProfile({
    required this.id,
    required this.email,
    required this.interests,
    this.notificationsEnabled = true,
    NotificationPrefs? notificationPrefs,
    required this.createdAt,
  }) : notificationPrefs = notificationPrefs ?? NotificationPrefs();

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String,
      email: json['email'] as String,
      interests: List<String>.from(json['interests'] ?? []),
      notificationsEnabled: json['notificationsEnabled'] ?? true,
      notificationPrefs: NotificationPrefs.fromJson(
        json['notificationPrefs'] as Map<String, dynamic>?,
      ),
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'interests': interests,
      'createdAt': createdAt,
    };
  }
}
