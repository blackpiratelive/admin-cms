# Mobile Microblog (Cupertino iOS Client)

A standalone Flutter mobile application designed exclusively for **Microblogging** with Apple's **Cupertino** design system, built for the `admin-cms` Personal Knowledge Platform.

📖 **Architecture Blueprint & Handoff Guide**: Read [MICROBLOG_APP_HANDOFF.md](../MICROBLOG_APP_HANDOFF.md) for complete architectural documentation, API contracts, screen specifications, and CI/CD pipelines.

---

## Features

- **Pure Apple Cupertino Design Language**: Built with `CupertinoApp`, `CupertinoSliverNavigationBar`, `CupertinoSliverRefreshControl`, `CupertinoSlidingSegmentedControl`, `CupertinoActionSheet`, and `CupertinoListSection.insetGrouped`.
- **Dynamic Light & Dark Theme**: Automatically adapts between iOS light mode and deep zinc dark mode.
- **Social Micro-Cards**: Formatted Markdown rendering via `flutter_markdown`, status indicators (Published vs Draft), relative timestamps, and multi-photo thumbnail preview grids.
- **Interactive Lightbox**: Full-screen photo gallery with pinch-to-zoom (`InteractiveViewer`) and swipe navigation.
- **Fast Modal Composer**: Instant thought capture with live character and word counters, camera/library photo upload directly to Cloudinary, tag management, and status toggle.
- **Action Sheets**: iOS action sheets with haptic feedback for editing, toggling status, copying short URLs, and destructive deletion.
- **Inset-Grouped Settings**: Easily configure Server URL (with localhost and Android emulator presets), trigger static Hugo site rebuilds, and manage offline cached posts.

---

## Quick Start

### 1. Install Dependencies
```bash
flutter pub get
```

### 2. Run Static Analysis & Tests
```bash
flutter analyze
flutter test
```

### 3. Run the App
```bash
# On Linux Desktop:
flutter run -d linux

# On Android Device / Emulator:
flutter run -d android
```

### 4. Build Release APK (ARM64)
```bash
flutter build apk --release --target-platform android-arm64
```
Output: `build/app/outputs/flutter-apk/app-release.apk`
