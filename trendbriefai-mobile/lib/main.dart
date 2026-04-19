import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/app_theme.dart';
import 'providers/theme_provider.dart';
import 'providers/onboarding_provider.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'services/cache_service.dart';
import 'services/review_prompt_service.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/home_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/article_detail_screen.dart';
import 'screens/search_screen.dart';
import 'screens/reading_history_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final cacheService = CacheService();
  await cacheService.init();

  final themeProvider = ThemeProvider();
  await themeProvider.load();

  final onboardingProvider = OnboardingProvider();
  await onboardingProvider.load();

  final reviewService = ReviewPromptService();
  await reviewService.incrementDaysOpened();

  runApp(TrendBriefApp(
    themeProvider: themeProvider,
    onboardingProvider: onboardingProvider,
  ));
}

class TrendBriefApp extends StatelessWidget {
  final ThemeProvider themeProvider;
  final OnboardingProvider onboardingProvider;

  const TrendBriefApp({
    super.key,
    required this.themeProvider,
    required this.onboardingProvider,
  });

  @override
  Widget build(BuildContext context) {
    final apiService = ApiService();

    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: themeProvider),
        ChangeNotifierProvider.value(value: onboardingProvider),
        ChangeNotifierProvider(create: (_) => AuthService(apiService)),
      ],
      child: Consumer<ThemeProvider>(
        builder: (_, theme, child) => MaterialApp(
          title: 'TrendBrief AI',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: theme.themeMode,
          initialRoute: '/login',
          routes: {
            '/login': (_) => const LoginScreen(),
            '/register': (_) => const RegisterScreen(),
            '/home': (_) => const HomeScreen(),
            '/onboarding': (_) => const OnboardingScreen(),
            '/search': (_) => const SearchScreen(),
            '/history': (_) => const ReadingHistoryScreen(),
          },
          onGenerateRoute: (settings) {
            if (settings.name?.startsWith('/article/') == true) {
              final id = settings.name!.replaceFirst('/article/', '');
              return MaterialPageRoute(
                builder: (_) => ArticleDetailScreen(articleId: id),
              );
            }
            return null;
          },
        ),
      ),
    );
  }
}
