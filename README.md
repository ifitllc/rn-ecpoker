# ECPoker

A React Native (Expo) poker score-tracking app with Supabase backend. Track player ranks across rounds, view leaderboards, and browse historical game dashboards.

## Prerequisites

- **Node.js** ≥ 18
- **npm** or **yarn**
- **EAS CLI** — `npm install -g eas-cli`
- **Xcode** (for iOS local builds, macOS only)
- **Android Studio / SDK** (for Android local builds)
- **CocoaPods** — `gem install cocoapods` (iOS)
- **Transporter.app** (optional, for App Store uploads via GUI)

## Setup

```bash
# Install dependencies
npm install

# (iOS only) Install CocoaPods
cd ios && pod install && cd ..
```

### Environment Variables

Create a `.env` file in the project root (or set these in your shell):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

For EAS cloud builds, push these as project secrets:

```bash
./eas-build.sh
```

## Development

```bash
# Start Expo dev server
npx expo start

# Open on iOS simulator
npx expo start --ios

# Open on Android emulator
npx expo start --android
```

## Building Locally

Before your first local build (or after changing `app.config.js` / native dependencies), regenerate the native projects:

```bash
npx expo prebuild --clean
```

### iOS (IPA for App Store)

```bash
eas build --platform ios --profile production --local
```

This produces a `.ipa` file in the project root (e.g. `build-<timestamp>.ipa`).

### iOS (Internal / Ad-Hoc)

```bash
eas build --platform ios --profile internal --local
```

### Android (AAB for Google Play)

```bash
eas build --platform android --profile production --local
```

This produces an `.aab` file in the project root.

### Android (APK for Internal Testing)

```bash
eas build --platform android --profile internal --local
```

## Deploying

### iOS — App Store

1. Build the production IPA locally (see above).
2. Upload via **Transporter.app** — drag the `.ipa` into the app, or use the CLI:
   ```bash
   xcrun altool --upload-app \
     -f build-<timestamp>.ipa \
     -t ios \
     -u YOUR_APPLE_ID \
     -p YOUR_APP_SPECIFIC_PASSWORD
   ```
3. Open [App Store Connect](https://appstoreconnect.apple.com), select the build, attach it to a release, and submit for review.

### Android — Google Play

1. Build the production AAB locally (see above).
2. Go to [Google Play Console](https://play.google.com/console), select your app.
3. Navigate to **Release** → **Production** (or testing track), upload the `.aab`, and roll out.

### OTA Updates (Expo Updates)

For JS-only changes that don't require a native rebuild:

```bash
eas update --branch production --message "describe your change"
```

This pushes an over-the-air update to all users on the `production` channel.

## Version Bumping

Before each App Store / Play Store submission, bump the version in `app.config.js`:

| Field                        | Where              | Notes                              |
|------------------------------|--------------------|------------------------------------|
| `expo.version`               | `app.config.js`    | Semver string (e.g. `2.1.0`)      |
| `expo.ios.buildNumber`       | `app.config.js`    | Incrementing integer as string     |
| `expo.android.versionCode`   | `app.config.js`    | Incrementing integer               |

App Store Connect rejects uploads if `version` is ≤ the previously approved version.

## Project Structure

```
├── App.tsx                  # Entry point
├── src/
│   ├── screens/
│   │   ├── DashboardScreen.tsx   # Leaderboard + historical games
│   │   ├── GameScreen.tsx        # Round recording
│   │   └── SetupScreen.tsx       # Player management
│   ├── services/
│   │   └── supabaseClient.ts     # Supabase client init
│   ├── state/
│   │   └── GameProvider.tsx       # Game context & state machine
│   ├── utils/
│   │   └── scoreEngine.ts        # Scoring logic
│   └── types.ts                  # TypeScript interfaces
├── docs/
│   ├── app-plan.md
│   └── db-schema.md
├── app.config.js            # Expo config (dynamic)
├── eas.json                 # EAS Build profiles
└── package.json
```

## License

Private — all rights reserved.
