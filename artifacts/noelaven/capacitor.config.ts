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
  },
};

export default config;
