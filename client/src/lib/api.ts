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
  return config
})

export default api
