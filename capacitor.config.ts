import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.seed.app',
  appName: 'Seed',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    scrollEnabled: false
  }
};

export default config;
