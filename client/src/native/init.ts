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

  // OAuth deep-link callback (e.g. ae.sheencafe.app://login-callback?code=...)
  try {
    await App.addListener('appUrlOpen', async ({ url }) => {
      if (!url || !url.includes('login-callback')) return

      // Close the in-app browser FIRST so the app returns to the foreground
      // right away. Otherwise the (sometimes slow) code exchange runs while the
      // OAuth page is still on screen, leaving the user staring at a blank
      // Apple page until they manually minimise — exactly the reported bug.
      try {
        const { Browser } = await import('@capacitor/browser')
        await Browser.close()
      } catch {
        /* browser may already be closed */
      }

      // Now exchange the auth code for a session (in the foreground). The
      // logged-in redirect in Login.tsx then routes to the user's home page.
      try {
        const code = new URL(url).searchParams.get('code')
        if (code) {
          const { supabase } = await import('../lib/supabase')
          await supabase.auth.exchangeCodeForSession(code)
        }
      } catch {
        /* ignore — user can retry sign-in */
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
