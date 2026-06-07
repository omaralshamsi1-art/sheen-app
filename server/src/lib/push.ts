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
}

/**
 * Send a notification to every stored device token. Tokens FCM reports as
 * permanently invalid are pruned from the database.
 */
export async function sendToAll(title: string, body: string, data?: Record<string, string>): Promise<SendResult> {
  const messaging = getApp().messaging()

  const { data: rows, error } = await supabase.from('push_tokens').select('token')
  if (error) throw error
  const tokens = (rows ?? []).map((r) => r.token as string).filter(Boolean)
  if (tokens.length === 0) return { sent: 0, failed: 0, removed: 0 }

  let sent = 0
  let failed = 0
  const invalid: string[] = []

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
    })
  }

  if (invalid.length) {
    await supabase.from('push_tokens').delete().in('token', invalid)
  }

  return { sent, failed, removed: invalid.length }
}
