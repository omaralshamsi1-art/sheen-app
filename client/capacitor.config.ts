import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ae.sheencafe.app',
  appName: 'SHEEN Cafe',
  // The native shell ships the production web build from this folder.
  // Run `npm run build` (with VITE_API_URL pointing at the Railway API)
  // before `npx cap sync` so the bundled app talks to the live backend.
  webDir: 'dist',
  backgroundColor: '#1A1A1A',
  ios: {
    contentInset: 'always',
  },
  android: {
    // Allow the WebView to load over https only (no cleartext in production)
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // We hide it manually from initNative() once the web app has booted
      launchAutoHide: false,
      backgroundColor: '#1A1A1A',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1A1A1A',
    },
  },
}

export default config
