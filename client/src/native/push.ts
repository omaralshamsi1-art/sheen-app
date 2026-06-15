import { Capacitor } from '@capacitor/core'
import api from '../lib/api'

let registered = false

/**
 * Register this device for push notifications and store its FCM token on the
 * server. Uses Firebase Cloud Messaging (@capacitor-firebase/messaging) so the
 * token is an FCM token the backend can target via firebase-admin.
 * No-op in the browser and when called more than once. Safe to call after login.
 */
export async function registerPush(): Promise<void> {
  if (registered || !Capacitor.isNativePlatform()) return
  registered = true

  const { FirebaseMessaging } = await import('@capacitor-firebase/messaging')

  // Ask for notification permission if not decided yet.
  let perm = await FirebaseMessaging.checkPermissions()
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await FirebaseMessaging.requestPermissions()
  }
  if (perm.receive !== 'granted') {
    registered = false
    return
  }

  const saveToken = async (token: string | null | undefined) => {
    if (!token) return
    try {
      await api.post('/api/push/register', { token, platform: Capacitor.getPlatform() })
    } catch {
      /* will retry on next launch */
    }
  }

  // Current token now, plus any future rotations.
  try {
    const { token } = await FirebaseMessaging.getToken()
    await saveToken(token)
  } catch {
    registered = false
    return
  }

  await FirebaseMessaging.addListener('tokenReceived', (event) => {
    void saveToken(event?.token)
  })
}
