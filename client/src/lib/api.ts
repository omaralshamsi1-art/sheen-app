import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

// Attach user info headers for audit logging
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    config.headers['x-user-id'] = session.user.id
    config.headers['x-user-email'] = session.user.email ?? ''
  }
  // Attach kiosk token if this device is registered as a kiosk
  const kioskToken = typeof window !== 'undefined' ? localStorage.getItem('sheen_kiosk_token') : null
  if (kioskToken) {
    config.headers['x-kiosk-token'] = kioskToken
  }
  return config
})

export default api
