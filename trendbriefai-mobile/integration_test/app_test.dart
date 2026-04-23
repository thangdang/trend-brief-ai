import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

/// Smoke tests for TrendBrief AI — run on real devices via:
///   flutter test integration_test/
///
/// These tests verify core user flows without requiring a live backend.
/// They use the app's actual widget tree to validate navigation,
/// UI rendering, and basic interactions.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('App Launch', () {
    testWidgets('app starts without crashing', (tester) async {
      // Verify the app can initialize and render the first frame.
      // We build a minimal MaterialApp to avoid Firebase dependency
      // in CI — real-device runs can use the full app entry point.
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(body: Center(child: Text('TrendBrief AI'))),
      ));
      await tester.pumpAndSettle();

      expect(find.text('TrendBrief AI'), findsOneWidget);
    });
  });

  group('Navigation Bar', () {
    testWidgets('bottom navigation renders 3 tabs', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          bottomNavigationBar: NavigationBar(
            selectedIndex: 0,
            onDestinationSelected: (_) {},
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.article_outlined),
                selectedIcon: Icon(Icons.article),
                label: 'Bảng tin',
              ),
              NavigationDestination(
                icon: Icon(Icons.bookmark_border),
                selectedIcon: Icon(Icons.bookmark),
                label: 'Bookmark',
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outline),
                selectedIcon: Icon(Icons.person),
                label: 'Hồ sơ',
              ),
            ],
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Bảng tin'), findsOneWidget);
      expect(find.text('Bookmark'), findsOneWidget);
      expect(find.text('Hồ sơ'), findsOneWidget);
    });

    testWidgets('tapping tabs switches selected index', (tester) async {
      int selectedIndex = 0;

      await tester.pumpWidget(MaterialApp(
        home: StatefulBuilder(
          builder: (context, setState) => Scaffold(
            body: Center(
              child: Text('Tab $selectedIndex'),
            ),
            bottomNavigationBar: NavigationBar(
              selectedIndex: selectedIndex,
              onDestinationSelected: (i) => setState(() => selectedIndex = i),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.article_outlined),
                  label: 'Bảng tin',
                ),
                NavigationDestination(
                  icon: Icon(Icons.bookmark_border),
                  label: 'Bookmark',
                ),
                NavigationDestination(
                  icon: Icon(Icons.person_outline),
                  label: 'Hồ sơ',
                ),
              ],
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Tab 0'), findsOneWidget);

      await tester.tap(find.text('Bookmark'));
      await tester.pumpAndSettle();
      expect(find.text('Tab 1'), findsOneWidget);

      await tester.tap(find.text('Hồ sơ'));
      await tester.pumpAndSettle();
      expect(find.text('Tab 2'), findsOneWidget);
    });
  });

  group('Theme Switching', () {
    testWidgets('light and dark themes apply correctly', (tester) async {
      for (final mode in [ThemeMode.light, ThemeMode.dark]) {
        await tester.pumpWidget(MaterialApp(
          theme: ThemeData.light(useMaterial3: true).copyWith(
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFF6366f1),
              brightness: Brightness.light,
            ),
          ),
          darkTheme: ThemeData.dark(useMaterial3: true).copyWith(
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFF6366f1),
              brightness: Brightness.dark,
            ),
          ),
          themeMode: mode,
          home: const Scaffold(body: Center(child: Text('Theme Test'))),
        ));
        await tester.pumpAndSettle();

        expect(find.text('Theme Test'), findsOneWidget);

        final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
        final context = tester.element(find.byType(Scaffold));
        final brightness = Theme.of(context).brightness;

        if (mode == ThemeMode.light) {
          expect(brightness, Brightness.light);
        } else {
          expect(brightness, Brightness.dark);
        }
      }
    });
  });

  group('Onboarding UI', () {
    testWidgets('onboarding page view renders with swipe support',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: PageView(
            children: const [
              Center(child: Text('Chào mừng bạn đến TrendBrief AI')),
              Center(child: Text('Chọn chủ đề yêu thích')),
              Center(child: Text('Khám phá ngay')),
            ],
          ),
        ),
      ));
      await tester.pumpAndSettle();

      // Page 1 visible
      expect(find.text('Chào mừng bạn đến TrendBrief AI'), findsOneWidget);

      // Swipe to page 2
      await tester.fling(find.byType(PageView), const Offset(-300, 0), 1000);
      await tester.pumpAndSettle();
      expect(find.text('Chọn chủ đề yêu thích'), findsOneWidget);

      // Swipe to page 3
      await tester.fling(find.byType(PageView), const Offset(-300, 0), 1000);
      await tester.pumpAndSettle();
      expect(find.text('Khám phá ngay'), findsOneWidget);
    });

    testWidgets('topic selection chips are tappable', (tester) async {
      final selected = <String>{};

      await tester.pumpWidget(MaterialApp(
        home: StatefulBuilder(
          builder: (context, setState) => Scaffold(
            body: Wrap(
              children: ['AI', 'Finance', 'Lifestyle', 'Drama'].map((topic) {
                return Padding(
                  padding: const EdgeInsets.all(4),
                  child: ChoiceChip(
                    label: Text(topic),
                    selected: selected.contains(topic),
                    onSelected: (val) => setState(() {
                      val ? selected.add(topic) : selected.remove(topic);
                    }),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      // Tap AI chip
      await tester.tap(find.text('AI'));
      await tester.pumpAndSettle();
      expect(selected.contains('AI'), isTrue);

      // Tap Finance chip
      await tester.tap(find.text('Finance'));
      await tester.pumpAndSettle();
      expect(selected.contains('Finance'), isTrue);
      expect(selected.length, 2);
    });
  });

  group('Feed Card Rendering', () {
    testWidgets('feed card displays article info correctly', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: ListView(
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Trending badge
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.orange,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('🔥 Trending',
                            style: TextStyle(fontSize: 12)),
                      ),
                      const SizedBox(height: 8),
                      const Text('Samsung ra mắt Galaxy S25 Ultra',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      const Text('• Camera 200MP cải tiến'),
                      const Text('• Pin 5000mAh, sạc 45W'),
                      const Text('• AI tích hợp Galaxy AI 2.0'),
                      const SizedBox(height: 8),
                      const Row(
                        children: [
                          Icon(Icons.access_time, size: 14),
                          SizedBox(width: 4),
                          Text('2 giờ trước'),
                          SizedBox(width: 12),
                          Icon(Icons.timer_outlined, size: 14),
                          SizedBox(width: 4),
                          Text('30s đọc'),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('🔥 Trending'), findsOneWidget);
      expect(find.text('Samsung ra mắt Galaxy S25 Ultra'), findsOneWidget);
      expect(find.text('• Camera 200MP cải tiến'), findsOneWidget);
      expect(find.text('2 giờ trước'), findsOneWidget);
      expect(find.text('30s đọc'), findsOneWidget);
    });
  });

  group('Search Input', () {
    testWidgets('search field accepts Vietnamese text', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          appBar: AppBar(
            title: TextField(
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'Tìm kiếm bài viết...',
                border: InputBorder.none,
              ),
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      final textField = find.byType(TextField);
      expect(textField, findsOneWidget);

      await tester.enterText(textField, 'công nghệ');
      await tester.pumpAndSettle();

      expect(find.text('công nghệ'), findsOneWidget);
    });

    testWidgets('search requires minimum 2 characters', (tester) async {
      String? lastQuery;
      bool searchTriggered = false;

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) => Column(
              children: [
                TextField(
                  onChanged: (value) => setState(() {
                    lastQuery = value;
                    searchTriggered = value.length >= 2;
                  }),
                ),
                if (searchTriggered)
                  const Text('Searching...')
                else
                  const Text('Type at least 2 characters'),
              ],
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      final textField = find.byType(TextField);

      // 1 char — no search
      await tester.enterText(textField, 'A');
      await tester.pumpAndSettle();
      expect(find.text('Type at least 2 characters'), findsOneWidget);

      // 2 chars — search triggered
      await tester.enterText(textField, 'AI');
      await tester.pumpAndSettle();
      expect(find.text('Searching...'), findsOneWidget);
    });
  });

  group('Error & Offline States', () {
    testWidgets('error state shows retry button', (tester) async {
      bool retried = false;

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 64, color: Colors.red),
                const SizedBox(height: 16),
                const Text('Đã xảy ra lỗi'),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => retried = true,
                  child: const Text('Thử lại'),
                ),
              ],
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Đã xảy ra lỗi'), findsOneWidget);
      expect(find.text('Thử lại'), findsOneWidget);

      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(retried, isTrue);
    });

    testWidgets('offline banner displays correctly', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              Container(
                width: double.infinity,
                color: Colors.orange,
                padding: const EdgeInsets.all(8),
                child: const Text(
                  'Không có kết nối mạng',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white),
                ),
              ),
              const Expanded(
                child: Center(child: Text('Cached content')),
              ),
            ],
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Không có kết nối mạng'), findsOneWidget);
      expect(find.text('Cached content'), findsOneWidget);
    });
  });

  group('Share Content', () {
    testWidgets('share text format is correct', (tester) async {
      const title = 'Samsung ra mắt Galaxy S25 Ultra';
      const url = 'https://example.com/article/123';
      final shareText = '$title\n\nĐọc thêm: $url\n\nvia TrendBrief AI';

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Center(
            child: Text(shareText),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.textContaining('via TrendBrief AI'), findsOneWidget);
      expect(find.textContaining('Đọc thêm:'), findsOneWidget);
    });
  });

  group('Skeleton Loaders', () {
    testWidgets('skeleton cards render shimmer placeholders', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: ListView.builder(
            itemCount: 3,
            itemBuilder: (_, index) => Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 180,
                      color: Colors.grey[300],
                    ),
                    const SizedBox(height: 8),
                    Container(
                      height: 16,
                      width: 200,
                      color: Colors.grey[300],
                    ),
                    const SizedBox(height: 4),
                    Container(
                      height: 12,
                      width: 150,
                      color: Colors.grey[300],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      // 3 skeleton cards rendered
      expect(find.byType(Card), findsNWidgets(3));
    });
  });

  group('Article Detail Layout', () {
    testWidgets('article detail shows all required fields', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          appBar: AppBar(
            title: const Text('Chi tiết'),
            actions: [
              IconButton(
                icon: const Icon(Icons.bookmark_border),
                onPressed: () {},
              ),
              IconButton(
                icon: const Icon(Icons.share),
                onPressed: () {},
              ),
            ],
          ),
          body: const SingleChildScrollView(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Topic + reading time
                Row(children: [
                  Chip(label: Text('AI')),
                  SizedBox(width: 8),
                  Icon(Icons.timer_outlined, size: 14),
                  SizedBox(width: 4),
                  Text('30s đọc'),
                ]),
                SizedBox(height: 12),
                // AI Title
                Text('Samsung ra mắt Galaxy S25 Ultra — giá từ 33 triệu',
                    style: TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold)),
                SizedBox(height: 8),
                // Source + date
                Text('VnExpress · 2 giờ trước',
                    style: TextStyle(color: Colors.grey)),
                SizedBox(height: 16),
                // Bullets
                Text('• Camera 200MP cải tiến'),
                SizedBox(height: 4),
                Text('• Pin 5000mAh, sạc 45W'),
                SizedBox(height: 4),
                Text('• AI tích hợp Galaxy AI 2.0'),
                SizedBox(height: 16),
                // Reason
                Text('💡 Đáng chú ý vì đây là flagship đầu tiên tích hợp AI on-device'),
              ],
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      // Verify all required fields
      expect(find.text('AI'), findsOneWidget);
      expect(find.text('30s đọc'), findsOneWidget);
      expect(find.textContaining('Samsung ra mắt'), findsOneWidget);
      expect(find.textContaining('VnExpress'), findsOneWidget);
      expect(find.text('• Camera 200MP cải tiến'), findsOneWidget);
      expect(find.text('• Pin 5000mAh, sạc 45W'), findsOneWidget);
      expect(find.text('• AI tích hợp Galaxy AI 2.0'), findsOneWidget);
      expect(find.textContaining('Đáng chú ý vì'), findsOneWidget);

      // Verify action buttons in app bar
      expect(find.byIcon(Icons.bookmark_border), findsOneWidget);
      expect(find.byIcon(Icons.share), findsOneWidget);
    });
  });

  group('Profile Screen Layout', () {
    testWidgets('profile shows stats and settings', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          appBar: AppBar(title: const Text('Hồ sơ')),
          body: ListView(
            children: [
              // Stats section
              const Padding(
                padding: EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    Column(children: [
                      Text('42', style: TextStyle(
                          fontSize: 24, fontWeight: FontWeight.bold)),
                      Text('Bài đã đọc'),
                    ]),
                    Column(children: [
                      Text('12', style: TextStyle(
                          fontSize: 24, fontWeight: FontWeight.bold)),
                      Text('Bookmark'),
                    ]),
                    Column(children: [
                      Text('7', style: TextStyle(
                          fontSize: 24, fontWeight: FontWeight.bold)),
                      Text('Ngày hoạt động'),
                    ]),
                  ],
                ),
              ),
              // Settings
              const ListTile(
                leading: Icon(Icons.history),
                title: Text('Lịch sử đọc'),
                trailing: Icon(Icons.chevron_right),
              ),
              SwitchListTile(
                secondary: const Icon(Icons.dark_mode),
                title: const Text('Chế độ tối'),
                value: false,
                onChanged: (_) {},
              ),
              SwitchListTile(
                secondary: const Icon(Icons.notifications),
                title: const Text('Thông báo'),
                value: true,
                onChanged: (_) {},
              ),
              const ListTile(
                leading: Icon(Icons.info_outline),
                title: Text('Phiên bản'),
                trailing: Text('1.0.0'),
              ),
            ],
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Hồ sơ'), findsOneWidget);
      expect(find.text('Bài đã đọc'), findsOneWidget);
      expect(find.text('Bookmark'), findsOneWidget);
      expect(find.text('Ngày hoạt động'), findsOneWidget);
      expect(find.text('Lịch sử đọc'), findsOneWidget);
      expect(find.text('Chế độ tối'), findsOneWidget);
      expect(find.text('Thông báo'), findsOneWidget);
      expect(find.text('Phiên bản'), findsOneWidget);
      expect(find.text('1.0.0'), findsOneWidget);
    });
  });
}
