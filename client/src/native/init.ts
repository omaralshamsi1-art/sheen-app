import { Capacitor } from '@capacitor/core'

/**
 * Native-only shell setup (status bar, splash screen, Android back button).
 * Everything here is a no-op in the browser, so the website is unaffected —
 * the early return guarantees none of the native plugins run on web.
 */
export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
    import('@capacitor/app'),
  ])

  // Brand dark header → light status-bar icons
  try {
    await StatusBar.setStyle({ style: Style.Dark })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#1A1A1A' })
    }
  } catch {
    /* status bar not available — ignore */
  }

  // Android hardware back button: navigate back, or exit at the root screen
  try {
    await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back()
      } else {
        App.exitApp()
      }
    })
  } catch {
    /* App plugin not available — ignore */
  }

  // Hide the splash once the web app has booted
  try {
    await SplashScreen.hide()
  } catch {
    /* no splash — ignore */
  }
}
