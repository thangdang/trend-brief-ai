import 'package:flutter/material.dart';

class TopicChips extends StatelessWidget {
  final String selectedTopic;
  final ValueChanged<String> onSelected;

  const TopicChips({
    super.key,
    required this.selectedTopic,
    required this.onSelected,
  });

  static const _topics = [
    {'key': 'all', 'label': 'Tất cả'},
    {'key': 'ai', 'label': 'AI'},
    {'key': 'finance', 'label': 'Tài chính'},
    {'key': 'lifestyle', 'label': 'Đời sống'},
    {'key': 'drama', 'label': 'Drama'},
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: _topics.map((t) {
          final key = t['key']!;
          final isSelected = selectedTopic == key;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(t['label']!),
              selected: isSelected,
              onSelected: (_) => onSelected(key),
              selectedColor: Theme.of(context).colorScheme.primaryContainer,
              labelStyle: TextStyle(
                color: isSelected
                    ? Theme.of(context).colorScheme.onPrimaryContainer
                    : Theme.of(context).colorScheme.onSurface,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
