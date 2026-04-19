class TopicModel {
  final String key;
  final String label;
  final String icon;
  final String color;
  final int order;

  TopicModel({
    required this.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.order,
  });

  factory TopicModel.fromJson(Map<String, dynamic> json) {
    return TopicModel(
      key: json['key'] as String,
      label: json['label'] as String,
      icon: json['icon'] as String? ?? '📰',
      color: json['color'] as String? ?? '#6366F1',
      order: json['order'] as int? ?? 0,
    );
  }
}
