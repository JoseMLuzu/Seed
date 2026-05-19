import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.seed.app',
  appName: 'Seed',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true
  }
};

export default config;
