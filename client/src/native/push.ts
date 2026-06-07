import { Capacitor } from '@capacitor/core'
import api from '../lib/api'

let registered = false

/**
 * Register this device for push notifications and store its token on the server.
 * No-op in the browser and when called more than once. Safe to call after login.
 */
export async function registerPush(): Promise<void> {
  if (registered || !Capacitor.isNativePlatform()) return
  registered = true

  const { PushNotifications } = await import('@capacitor/push-notifications')

  let perm = await PushNotifications.checkPermissions()
  if (perm.receive === 'prompt') {
    perm = await PushNotifications.requestPermissions()
  }
  if (perm.receive !== 'granted') {
    registered = false
    return
  }

  // Send the FCM/APNs token to the backend when it arrives
  await PushNotifications.addListener('registration', async (token) => {
    try {
      await api.post('/api/push/register', {
        token: token.value,
        platform: Capacitor.getPlatform(),
      })
    } catch {
      /* will retry on next launch */
    }
  })

  await PushNotifications.addListener('registrationError', () => {
    registered = false
  })

  await PushNotifications.register()
}
