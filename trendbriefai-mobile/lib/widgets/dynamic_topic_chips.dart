import 'package:flutter/material.dart';
import '../models/topic_model.dart';
import '../services/api_service.dart';

class DynamicTopicChips extends StatefulWidget {
  final String selectedTopic;
  final ValueChanged<String> onSelected;

  const DynamicTopicChips({
    super.key,
    required this.selectedTopic,
    required this.onSelected,
  });

  @override
  State<DynamicTopicChips> createState() => _DynamicTopicChipsState();
}

class _DynamicTopicChipsState extends State<DynamicTopicChips> {
  final ApiService _api = ApiService();
  List<TopicModel> _topics = [];
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _loadTopics();
  }

  Future<void> _loadTopics() async {
    try {
      final data = await _api.getTopics();
      setState(() {
        _topics = data.map((e) => TopicModel.fromJson(e)).toList();
        _loaded = true;
      });
    } catch (_) {
      setState(() => _loaded = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded) {
      return const SizedBox(height: 48);
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: const Text('Tất cả'),
              selected: widget.selectedTopic == 'all',
              onSelected: (_) => widget.onSelected('all'),
              selectedColor: Theme.of(context).colorScheme.primaryContainer,
            ),
          ),
          ..._topics.map((t) => Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(t.label),
              selected: widget.selectedTopic == t.key,
              onSelected: (_) => widget.onSelected(t.key),
              selectedColor: Theme.of(context).colorScheme.primaryContainer,
            ),
          )),
        ],
      ),
    );
  }
}
