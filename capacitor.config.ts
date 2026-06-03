import type { CapacitorConfig } from '@capacitor/cli';

const config = {
  appId: 'seedapp.com.ec',
  appName: 'Seeds',
  webDir: 'dist',
  backgroundColor: '#f5f5f7',
  ios: {
    backgroundColor: '#f5f5f7',
    contentInset: 'never',
    scrollEnabled: true
  }
} as CapacitorConfig;

export default config;
