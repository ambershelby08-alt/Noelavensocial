import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.noelaven.app',
  appName: 'Noelaven',
  webDir: 'dist/public',
  server: {
    // Load the live hosted app instead of bundling assets
    url: 'https://noelaven.com',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f0f10',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0f0f10',
    },
    PushNotifications: {
      /**
       * Controls which notification channels trigger heads-up alerts when the
       * app is in the FOREGROUND on Android.  When the app is closed or
       * backgrounded, FCM always shows a system notification regardless of this
       * setting — that is the primary use-case for Play Store compliance.
       *
       * 'badge'  — update the app icon badge count
       * 'sound'  — play the default notification sound
       * 'alert'  — show the heads-up notification banner
       */
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
