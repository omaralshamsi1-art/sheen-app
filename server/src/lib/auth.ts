import { Request } from 'express'
import { supabase } from './supabase'

/**
 * Lightweight admin check based on the x-user-id header that the client attaches
 * to every request (see client/src/lib/api.ts). Looks the role up in user_roles.
 * Not a substitute for full auth, but enough to gate broadcast/admin actions.
 */
export async function isRequesterAdmin(req: Request): Promise<boolean> {
  const userId = req.headers['x-user-id'] as string | undefined
  if (!userId) return false

  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  return data?.role === 'admin'
}
