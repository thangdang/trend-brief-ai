import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/user_stats.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import 'reading_history_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _api = ApiService();
  UserStats? _stats;
  bool _notificationsEnabled = true;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    try {
      final data = await _api.getUserStats();
      if (mounted) setState(() => _stats = UserStats.fromJson(data));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final themeProvider = context.watch<ThemeProvider>();
    final profile = auth.profile;
    final theme = Theme.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar + email
          Center(child: Column(children: [
            CircleAvatar(
              radius: 40,
              backgroundColor: theme.colorScheme.primaryContainer,
              child: Text(
                (profile?.email.isNotEmpty == true) ? profile!.email[0].toUpperCase() : '?',
                style: TextStyle(fontSize: 32, color: theme.colorScheme.onPrimaryContainer),
              ),
            ),
            const SizedBox(height: 12),
            Text(profile?.email ?? '', style: theme.textTheme.titleMedium),
          ])),
          const SizedBox(height: 24),

          // Stats
          if (_stats != null) ...[
            Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
              _StatCard(label: 'Đã đọc', value: '${_stats!.totalArticlesRead}', icon: Icons.article),
              _StatCard(label: 'Bookmark', value: '${_stats!.totalBookmarks}', icon: Icons.bookmark),
              _StatCard(label: 'Ngày hoạt động', value: '${_stats!.daysActive}', icon: Icons.calendar_today),
            ]),
            const SizedBox(height: 24),
          ],

          // Menu items
          ListTile(
            leading: const Icon(Icons.history),
            title: const Text('Lịch sử đọc'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReadingHistoryScreen())),
          ),
          const Divider(),

          // Settings
          Text('Cài đặt', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          SwitchListTile(
            title: const Text('Chế độ tối'),
            secondary: const Icon(Icons.dark_mode),
            value: themeProvider.isDark,
            onChanged: (_) => themeProvider.toggle(),
          ),
          SwitchListTile(
            title: const Text('Thông báo'),
            secondary: const Icon(Icons.notifications),
            value: _notificationsEnabled,
            onChanged: (v) async {
              setState(() => _notificationsEnabled = v);
              await _api.updateSettings({'notifications_enabled': v});
            },
          ),
          const Divider(),

          // App version
          Center(child: Text('TrendBrief AI v1.0.0', style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey))),
          const SizedBox(height: 16),

          // Logout
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () async {
                await auth.logout();
                if (context.mounted) Navigator.pushReplacementNamed(context, '/login');
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

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const _StatCard({required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(children: [
      Icon(icon, color: theme.colorScheme.primary),
      const SizedBox(height: 4),
      Text(value, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
      Text(label, style: theme.textTheme.bodySmall),
    ]);
  }
}
