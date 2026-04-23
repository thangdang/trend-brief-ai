import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'config/firebase_options.dart';
import 'config/app_theme.dart';
import 'providers/theme_provider.dart';
import 'providers/onboarding_provider.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'services/cache_service.dart';
import 'services/analytics_service.dart';
import 'services/crash_reporting_service.dart';
import 'services/review_prompt_service.dart';
import 'services/notification_service.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/home_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/article_detail_screen.dart';
import 'screens/search_screen.dart';
import 'screens/reading_history_screen.dart';

/// Global navigator key for deep-link navigation from notifications.
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Register background message handler (must be top-level function)
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  // Initialize Crashlytics
  final crashService = CrashReportingService();
  await crashService.initialize();

  final cacheService = CacheService();
  await cacheService.init();

  final themeProvider = ThemeProvider();
  await themeProvider.load();

  final onboardingProvider = OnboardingProvider();
  await onboardingProvider.load();

  final reviewService = ReviewPromptService();
  await reviewService.incrementDaysOpened();

  // Set navigator key for notification deep links
  NotificationService.navigatorKey = navigatorKey;

  // Wrap in runZonedGuarded to catch all uncaught async errors
  runZonedGuarded(
    () {
      runApp(TrendBriefApp(
        themeProvider: themeProvider,
        onboardingProvider: onboardingProvider,
      ));
    },
    crashService.onZoneError,
  );
}

class TrendBriefApp extends StatefulWidget {
  final ThemeProvider themeProvider;
  final OnboardingProvider onboardingProvider;

  const TrendBriefApp({
    super.key,
    required this.themeProvider,
    required this.onboardingProvider,
  });

  @override
  State<TrendBriefApp> createState() => _TrendBriefAppState();
}

class _TrendBriefAppState extends State<TrendBriefApp> {
  late final ApiService _apiService;
  late final NotificationService _notificationService;

  @override
  void initState() {
    super.initState();
    _apiService = ApiService();
    _notificationService = NotificationService(_apiService);
    // Initialize FCM after first frame so navigator is ready
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _notificationService.init();
    });
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: widget.themeProvider),
        ChangeNotifierProvider.value(value: widget.onboardingProvider),
        ChangeNotifierProvider(create: (_) => AuthService(_apiService)),
      ],
      child: Consumer<ThemeProvider>(
        builder: (_, theme, child) => MaterialApp(
          title: 'TrendBrief AI',
          debugShowCheckedModeBanner: false,
          navigatorKey: navigatorKey,
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: theme.themeMode,
          navigatorObservers: [AnalyticsService().observer],
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
