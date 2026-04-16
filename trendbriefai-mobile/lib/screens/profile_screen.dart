import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  static const _allTopics = [
    {'key': 'ai', 'label': 'AI'},
    {'key': 'finance', 'label': 'Tài chính'},
    {'key': 'lifestyle', 'label': 'Đời sống'},
    {'key': 'drama', 'label': 'Drama'},
  ];

  late Set<String> _selected;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthService>();
    _selected = Set<String>.from(auth.profile?.interests ?? []);
  }

  Future<void> _saveInterests() async {
    setState(() => _saving = true);
    try {
      await context.read<AuthService>().updateInterests(_selected.toList());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã cập nhật sở thích')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lỗi khi cập nhật')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final profile = auth.profile;
    final theme = Theme.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar + email
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: theme.colorScheme.primaryContainer,
                  child: Text(
                    (profile?.email.isNotEmpty == true)
                        ? profile!.email[0].toUpperCase()
                        : '?',
                    style: TextStyle(
                      fontSize: 32,
                      color: theme.colorScheme.onPrimaryContainer,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(profile?.email ?? '',
                    style: theme.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  'Tham gia: ${profile?.createdAt.split('T').first ?? ''}',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: Colors.grey[600]),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          Text('Chủ đề quan tâm',
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('Chọn chủ đề để cá nhân hóa bảng tin của bạn',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: Colors.grey[600])),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _allTopics.map((t) {
              final key = t['key']!;
              final isSelected = _selected.contains(key);
              return FilterChip(
                label: Text(t['label']!),
                selected: isSelected,
                onSelected: (selected) {
                  setState(() {
                    if (selected) {
                      _selected.add(key);
                    } else {
                      _selected.remove(key);
                    }
                  });
                },
                selectedColor: theme.colorScheme.primaryContainer,
              );
            }).toList(),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _saveInterests,
              child: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Lưu sở thích'),
            ),
          ),
          const SizedBox(height: 32),
          const Divider(),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () async {
                await auth.logout();
                if (context.mounted) {
                  Navigator.pushReplacementNamed(context, '/login');
                }
              },
              icon: const Icon(Icons.logout),
              label: const Text('Đăng xuất'),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
            ),
          ),
        ],
      ),
    );
  }
}
