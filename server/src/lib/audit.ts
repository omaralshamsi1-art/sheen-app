import { supabase } from './supabase'
import type { Request } from 'express'

export type AuditAction = 'create' | 'update' | 'delete'
export type AuditEntity = 'sale' | 'expense' | 'fixed_cost' | 'menu_item' | 'order' | 'user_role'

interface AuditEntry {
  action: AuditAction
  entity: AuditEntity
  entity_id?: string | string[]
  details?: Record<string, any>
}

export async function logAudit(req: Request, entry: AuditEntry) {
  try {
    const userEmail = req.headers['x-user-email'] as string | undefined
    const userId = req.headers['x-user-id'] as string | undefined

    await supabase.from('audit_logs').insert({
      user_id: userId ?? null,
      user_email: userEmail ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: Array.isArray(entry.entity_id) ? entry.entity_id[0] : (entry.entity_id ?? null),
      details: entry.details ?? null,
      ip_address: req.ip ?? req.headers['x-forwarded-for'] ?? null,
    })
  } catch (err) {
    // Don't let audit failures break the main operation
    console.error('Audit log error:', err)
  }
}
