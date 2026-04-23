import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/user_stats.dart';
import '../models/user_profile.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/notification_service.dart';
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
  // Per-type notification preferences (Task 26.5)
  bool _trendingEnabled = true;
  bool _topicEnabled = true;
  bool _dailyEnabled = true;
  bool _weeklyEnabled = true;

  @override
  void initState() {
    super.initState();
    _loadStats();
    _loadNotificationPrefs();
  }

  Future<void> _loadStats() async {
    try {
      final data = await _api.getUserStats();
      if (mounted) setState(() => _stats = UserStats.fromJson(data));
    } catch (_) {}
  }

  Future<void> _loadNotificationPrefs() async {
    try {
      final profile = await _api.getProfile();
      if (mounted) {
        setState(() {
          _notificationsEnabled = profile.notificationsEnabled;
          _trendingEnabled = profile.notificationPrefs.trending;
          _topicEnabled = profile.notificationPrefs.topic;
          _dailyEnabled = profile.notificationPrefs.daily;
          _weeklyEnabled = profile.notificationPrefs.weekly;
        });
      }
    } catch (_) {}
  }

  Future<void> _updateNotifPref(String key, bool value) async {
    await _api.updateSettings({
      'notification_prefs': {key: value},
    });
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
            if (_stats!.streakCount > 0) ...[
              const SizedBox(height: 12),
              Center(child: Text('🔥 ${_stats!.streakCount} ngày liên tiếp', style: theme.textTheme.titleMedium?.copyWith(color: Colors.orange, fontWeight: FontWeight.bold))),
            ],
            const SizedBox(height: 24),
          ],

          // Menu items
          ListTile(
            leading: const Icon(Icons.history),
            title: const Text('Lịch sử đọc'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReadingHistoryScreen())),
          ),
          // Referral button (Task 30.2)
          ListTile(
            leading: const Icon(Icons.card_giftcard),
            title: const Text('Mời bạn bè'),
            subtitle: const Text('Nhận 7 ngày Premium miễn phí'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () async {
              try {
                final result = await _api.getReferralCode();
                if (mounted) {
                  final link = result['link'] ?? '';
                  showDialog(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Mời bạn bè'),
                      content: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Text('Chia sẻ link này để mời bạn bè:'),
                        const SizedBox(height: 12),
                        SelectableText(link, style: const TextStyle(fontWeight: FontWeight.bold)),
                      ]),
                      actions: [
                        TextButton(
                          onPressed: () {
                            Clipboard.setData(ClipboardData(text: link));
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Đã copy link!')),
                            );
                          },
                          child: const Text('Copy link'),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Đóng'),
                        ),
                      ],
                    ),
                  );
                }
              } catch (_) {}
            },
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
              final notifService = NotificationService(_api);
              if (!v) {
                await notifService.unregisterToken();
              }
            },
          ),
          // Per-type notification toggles (Task 26.5)
          if (_notificationsEnabled) ...[
            Padding(
              padding: const EdgeInsets.only(left: 16),
              child: Column(children: [
                SwitchListTile(
                  title: const Text('Tin nổi bật'),
                  subtitle: const Text('Bài viết đang hot'),
                  dense: true,
                  value: _trendingEnabled,
                  onChanged: (v) {
                    setState(() => _trendingEnabled = v);
                    _updateNotifPref('trending', v);
                  },
                ),
                SwitchListTile(
                  title: const Text('Chủ đề theo dõi'),
                  subtitle: const Text('Bài mới trong chủ đề bạn quan tâm'),
                  dense: true,
                  value: _topicEnabled,
                  onChanged: (v) {
                    setState(() => _topicEnabled = v);
                    _updateNotifPref('topic', v);
                  },
                ),
                SwitchListTile(
                  title: const Text('Tin hàng ngày'),
                  subtitle: const Text('Tin nổi bật mỗi sáng 8h'),
                  dense: true,
                  value: _dailyEnabled,
                  onChanged: (v) {
                    setState(() => _dailyEnabled = v);
                    _updateNotifPref('daily', v);
                  },
                ),
                SwitchListTile(
                  title: const Text('Tổng hợp tuần'),
                  subtitle: const Text('Top 5 bài viết mỗi Chủ nhật'),
                  dense: true,
                  value: _weeklyEnabled,
                  onChanged: (v) {
                    setState(() => _weeklyEnabled = v);
                    _updateNotifPref('weekly', v);
                  },
                ),
              ]),
            ),
          ],
          ListTile(
            leading: const Icon(Icons.privacy_tip_outlined),
            title: const Text('Chính sách bảo mật'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => launchUrl(
              Uri.parse('https://trendbriefai.vn/privacy'),
              mode: LaunchMode.externalApplication,
            ),
          ),
          ListTile(
            leading: const Icon(Icons.description_outlined),
            title: const Text('Điều khoản sử dụng'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => launchUrl(
              Uri.parse('https://trendbriefai.vn/terms'),
              mode: LaunchMode.externalApplication,
            ),
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
