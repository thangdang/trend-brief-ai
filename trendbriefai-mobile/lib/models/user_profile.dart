class UserProfile {
  final String id;
  final String email;
  final List<String> interests;
  final String createdAt;

  UserProfile({
    required this.id,
    required this.email,
    required this.interests,
    required this.createdAt,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String,
      email: json['email'] as String,
      interests: List<String>.from(json['interests'] ?? []),
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
