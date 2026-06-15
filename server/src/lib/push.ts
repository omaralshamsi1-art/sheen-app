import * as admin from 'firebase-admin'
import { supabase } from './supabase'

/**
 * Push notifications via Firebase Cloud Messaging (covers both iOS and Android).
 * Stays dormant until FIREBASE_SERVICE_ACCOUNT is set, so the rest of the app is
 * unaffected until you configure it. See MOBILE_APP_SETUP.md.
 */

let app: admin.app.App | null = null

export function isPushConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT)
}

function getApp(): admin.app.App {
  if (app) return app

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('Push is not configured')

  // Accept either raw JSON or a base64-encoded service-account JSON
  const json = raw.trim().startsWith('{')
    ? raw
    : Buffer.from(raw, 'base64').toString('utf8')
  const credential = admin.credential.cert(JSON.parse(json))

  app = admin.apps.length ? admin.app() : admin.initializeApp({ credential })
  return app
}

export interface SendResult {
  sent: number
  failed: number
  removed: number
  errors?: string[]
}

/**
 * Send a notification to a specific list of device tokens. Tokens FCM reports as
 * permanently invalid are pruned from the database.
 */
async function sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<SendResult> {
  if (tokens.length === 0) return { sent: 0, failed: 0, removed: 0 }
  const messaging = getApp().messaging()

  let sent = 0
  let failed = 0
  const invalid: string[] = []
  const errorCounts = new Map<string, number>()

  // FCM multicast caps at 500 tokens per call
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500)
    const resp = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: data ?? {},
    })
    sent += resp.successCount
    failed += resp.failureCount
    resp.responses.forEach((r, idx) => {
      const code = r.error?.code
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        invalid.push(batch[idx])
      }
      if (r.error) {
        const key = `${r.error.code}: ${r.error.message}`
        errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1)
        console.error('[push] send failure:', key)
      }
    })
  }

  if (invalid.length) {
    await supabase.from('push_tokens').delete().in('token', invalid)
  }

  const errors = [...errorCounts.entries()].map(([k, n]) => `${k} (x${n})`)
  return { sent, failed, removed: invalid.length, ...(errors.length ? { errors } : {}) }
}

/** Send a notification to every stored device token. */
export async function sendToAll(title: string, body: string, data?: Record<string, string>): Promise<SendResult> {
  const { data: rows, error } = await supabase.from('push_tokens').select('token')
  if (error) throw error
  const tokens = (rows ?? []).map((r) => r.token as string).filter(Boolean)
  return sendToTokens(tokens, title, body, data)
}

/** Send a notification only to devices of users holding one of the given roles. */
export async function sendToRoles(roles: string[], title: string, body: string, data?: Record<string, string>): Promise<SendResult> {
  const { data: roleRows, error: roleErr } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', roles)
  if (roleErr) throw roleErr
  const userIds = (roleRows ?? []).map((r) => r.user_id as string).filter(Boolean)
  if (userIds.length === 0) return { sent: 0, failed: 0, removed: 0 }

  const { data: rows, error } = await supabase
    .from('push_tokens')
    .select('token')
    .in('user_id', userIds)
  if (error) throw error
  const tokens = (rows ?? []).map((r) => r.token as string).filter(Boolean)
  return sendToTokens(tokens, title, body, data)
}
