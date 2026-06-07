import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { registerPush } from '../native/push'

/**
 * Registers the device for push notifications once a user is logged in.
 * Renders nothing and is a no-op on the web (see registerPush).
 */
export default function PushManager() {
  const { user } = useAuth()

  useEffect(() => {
    if (user) registerPush()
  }, [user])

  return null
}
