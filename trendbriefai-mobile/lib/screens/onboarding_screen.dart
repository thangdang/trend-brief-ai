import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/topic_model.dart';
import '../providers/onboarding_provider.dart';
import '../services/api_service.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pageController = PageController();
  final _api = ApiService();
  int _currentPage = 0;
  List<TopicModel> _topics = [];
  final Set<String> _selectedTopics = {};
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadTopics();
  }

  Future<void> _loadTopics() async {
    try {
      final data = await _api.getTopics();
      setState(() => _topics = data.map((e) => TopicModel.fromJson(e)).toList());
    } catch (_) {}
  }

  void _next() {
    if (_currentPage < 2) {
      _pageController.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
    }
  }

  Future<void> _complete() async {
    if (_selectedTopics.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chọn ít nhất 1 chủ đề')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await _api.saveOnboarding(_selectedTopics.toList());
      if (mounted) {
        await context.read<OnboardingProvider>().markCompleted();
        Navigator.pushReplacementNamed(context, '/home');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lỗi, vui lòng thử lại')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Column(children: [
          Expanded(
            child: PageView(
              controller: _pageController,
              onPageChanged: (i) => setState(() => _currentPage = i),
              children: [
                _WelcomePage(),
                _TopicSelectionPage(
                  topics: _topics,
                  selected: _selectedTopics,
                  onToggle: (key) => setState(() {
                    _selectedTopics.contains(key) ? _selectedTopics.remove(key) : _selectedTopics.add(key);
                  }),
                ),
                _CompletionPage(),
              ],
            ),
          ),
          // Dots
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(3, (i) => Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: _currentPage == i ? 24 : 8,
              height: 8,
              decoration: BoxDecoration(
                color: _currentPage == i ? cs.primary : cs.outline,
                borderRadius: BorderRadius.circular(4),
              ),
            )),
          ),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : (_currentPage == 2 ? _complete : _next),
                child: _saving
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(_currentPage == 2 ? 'Bắt đầu đọc' : 'Tiếp tục'),
              ),
            ),
          ),
          const SizedBox(height: 32),
        ]),
      ),
    );
  }
}

class _WelcomePage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(Icons.auto_awesome, size: 80, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 24),
        Text('Chào mừng đến TrendBrief', style: Theme.of(context).textTheme.headlineSmall, textAlign: TextAlign.center),
        const SizedBox(height: 12),
        Text('Tin tức AI tóm tắt — đọc nhanh, hiểu sâu, không bỏ lỡ trend.',
          style: Theme.of(context).textTheme.bodyLarge, textAlign: TextAlign.center),
      ]),
    );
  }
}

class _TopicSelectionPage extends StatelessWidget {
  final List<TopicModel> topics;
  final Set<String> selected;
  final ValueChanged<String> onToggle;

  const _TopicSelectionPage({required this.topics, required this.selected, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Text('Chọn chủ đề quan tâm', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text('Chọn ít nhất 1 chủ đề để cá nhân hóa bảng tin', style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 24),
        Wrap(
          spacing: 8, runSpacing: 8,
          children: topics.map((t) => FilterChip(
            label: Text(t.label),
            selected: selected.contains(t.key),
            onSelected: (_) => onToggle(t.key),
            selectedColor: Theme.of(context).colorScheme.primaryContainer,
          )).toList(),
        ),
      ]),
    );
  }
}

class _CompletionPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(Icons.check_circle, size: 80, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 24),
        Text('Sẵn sàng!', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 12),
        Text('Bảng tin đã được cá nhân hóa theo sở thích của bạn.',
          style: Theme.of(context).textTheme.bodyLarge, textAlign: TextAlign.center),
      ]),
    );
  }
}
