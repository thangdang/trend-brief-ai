# Splash Screen Assets

## Required

- **splash_logo.png** — Centered logo displayed on the splash screen
  - Recommended size: 300×300 pixels
  - Transparent background (PNG)
  - Design: White "TrendBrief AI" text or logo mark on transparent background

## Configuration

The splash screen uses `flutter_native_splash` configured in `pubspec.yaml`:

- Background color: `#6366f1` (indigo primary)
- Android 12+ adaptive splash supported
- iOS enabled, web disabled

## Generating the Splash Screen

After placing `splash_logo.png` in this directory, run:

```bash
dart run flutter_native_splash:create
```

This generates platform-specific splash screen resources for Android and iOS.
