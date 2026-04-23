# TrendBrief AI — App Icon

## Required File

Place `app_icon.png` in this directory (`assets/icon/app_icon.png`).

### Specifications

| Property | Value |
|----------|-------|
| Filename | `app_icon.png` |
| Size | **1024×1024 px** (generates all smaller sizes including 512×512) |
| Format | PNG, no transparency for iOS (use solid background) |
| Color space | sRGB |

### Design Spec

- **Background:** Indigo `#6366f1`
- **Foreground:** White "TB" letters or lightning bolt icon, centered
- **Safe zone:** Keep foreground within the center 66% for adaptive icon cropping (Android)
- **Corner radius:** None — platforms apply their own masking

### Generate Icons

After placing `app_icon.png` here, run from the project root:

```bash
dart run flutter_launcher_icons
```

This generates all required icon sizes for:
- **Android:** `mipmap-mdpi` through `mipmap-xxxhdpi` + adaptive icon resources
- **iOS:** `AppIcon.appiconset` (all sizes from 20pt to 1024pt)
- **Web:** `favicon.png`, `Icon-192.png`, `Icon-512.png`, `Icon-maskable-192.png`, `Icon-maskable-512.png`

### Configuration

The `flutter_launcher_icons` configuration is in `pubspec.yaml` under the `flutter_launcher_icons:` key.
