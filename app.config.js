const fs = require('fs');
const path = require('path');

// Load .env ourselves so values are always available, regardless of build method.
function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) return {};
  const vars = {};
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) vars[m[1]] = m[2].trim();
    });
  return vars;
}

const dotenv = loadEnv();
const env = (key) => process.env[key] || dotenv[key] || '';

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'ECPoker',
    slug: 'ecpoker',
    version: '2.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon-from-svg.png',
    splash: {
      image: './assets/icon-from-svg.png',
      resizeMode: 'contain',
      backgroundColor: '#0f1f1a',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.mdtta.ecpoker',
      buildNumber: '45',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#0f1f1a',
      },
      package: 'com.mdtta.ecpoker',
      versionCode: 45,
    },
    web: {},
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: env('EXPO_PUBLIC_SUPABASE_URL'),
      EXPO_PUBLIC_SUPABASE_ANON_KEY: env('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
      eas: {
        projectId: 'cd65a724-6308-4276-8c17-6546bd44d4cf',
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/cd65a724-6308-4276-8c17-6546bd44d4cf',
    },
  },
};
