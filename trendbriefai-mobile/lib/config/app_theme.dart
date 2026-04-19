import 'package:flutter/material.dart';

class AppTheme {
  static const _seedColor = Colors.indigo;

  static ThemeData get light => ThemeData(
        colorSchemeSeed: _seedColor,
        useMaterial3: true,
        brightness: Brightness.light,
        textTheme: _textTheme,
        cardTheme: _cardTheme,
        appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0),
        navigationBarTheme: const NavigationBarThemeData(elevation: 1),
      );

  static ThemeData get dark => ThemeData(
        colorSchemeSeed: _seedColor,
        useMaterial3: true,
        brightness: Brightness.dark,
        textTheme: _textTheme,
        cardTheme: _cardTheme,
        appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0),
        navigationBarTheme: const NavigationBarThemeData(elevation: 1),
      );

  static const _textTheme = TextTheme(
    headlineLarge: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
    headlineMedium: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
    headlineSmall: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
    titleLarge: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
    titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
    titleSmall: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
    bodyLarge: TextStyle(fontSize: 16, height: 1.5),
    bodyMedium: TextStyle(fontSize: 14, height: 1.5),
    bodySmall: TextStyle(fontSize: 12, height: 1.4),
    labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
    labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
    labelSmall: TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
  );

  static const _cardTheme = CardTheme(
    elevation: 1,
    margin: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.all(Radius.circular(12)),
    ),
  );
}
