import http2 from 'http2'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { supabase } from './supabase'

/**
 * Apple Wallet pass-update push (APNs) + the per-pass authentication token used
 * by the PassKit web service. Stays dormant until APNs credentials are present.
 *
 * Required env:
 *   APNS_AUTH_KEY        base64 of the .p8 token-signing key
 *   APNS_KEY_ID          the key's Key ID
 *   APPLE_TEAM_ID        (already used by the pass signer)
 *   APPLE_PASS_TYPE_ID   (already used by the pass signer) — APNs topic
 *   WALLET_AUTH_SECRET   secret used to derive each pass's auth token
 */

export function isWalletPushConfigured(): boolean {
  return Boolean(
    process.env.APNS_AUTH_KEY &&
      process.env.APNS_KEY_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_PASS_TYPE_ID,
  )
}

// Per-pass authentication token — a stateless HMAC of the serial number, so it
// can be validated on every PassKit request without storing anything.
export function walletAuthToken(serial: string): string {
  const secret = process.env.WALLET_AUTH_SECRET || 'sheen-wallet-secret'
  return crypto.createHmac('sha256', secret).update(serial).digest('hex')
}

export function verifyWalletAuth(serial: string, token?: string): boolean {
  if (!token) return false
  const expected = Buffer.from(walletAuthToken(serial))
  const given = Buffer.from(token)
  return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}

// APNs provider token (ES256 JWT), cached ~50 min as Apple recommends.
let cached: { token: string; iat: number } | null = null
// Accept the .p8 either as raw PEM (possibly with escaped \n) or base64 of the file.
function apnsPrivateKey(): string {
  const raw = process.env.APNS_AUTH_KEY || ''
  if (raw.includes('BEGIN')) return raw.replace(/\\n/g, '\n')
  return Buffer.from(raw, 'base64').toString('utf8')
}

function apnsToken(): string {
  const now = Math.floor(Date.now() / 1000)
  if (cached && now - cached.iat < 3000) return cached.token
  const key = apnsPrivateKey()
  const token = jwt.sign({ iss: process.env.APPLE_TEAM_ID!, iat: now }, key, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: process.env.APNS_KEY_ID! },
  })
  cached = { token, iat: now }
  return token
}

// Send a single empty-payload push that tells Wallet to fetch the latest pass.
// Returns the APNs status (0 on transport error). Stale tokens (410) are pruned.
function pushOne(pushToken: string): Promise<number> {
  return new Promise((resolve) => {
    let client: http2.ClientHttp2Session
    try {
      client = http2.connect('https://api.push.apple.com')
    } catch {
      resolve(0)
      return
    }
    client.on('error', () => resolve(0))
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      authorization: `bearer ${apnsToken()}`,
      'apns-topic': process.env.APPLE_PASS_TYPE_ID!,
      'apns-push-type': 'background',
      'apns-priority': '5',
      'content-type': 'application/json',
    })
    let status = 0
    req.on('response', (h) => {
      status = Number(h[':status']) || 0
    })
    req.on('data', () => {})
    req.on('end', () => {
      try { client.close() } catch {}
      resolve(status)
    })
    req.on('error', () => {
      try { client.close() } catch {}
      resolve(0)
    })
    req.end(JSON.stringify({}))
  })
}

/**
 * Mark a pass stale and push an update to every device registered for it.
 * Safe to call unconditionally — no-ops when Wallet push isn't configured.
 */
export async function notifyWalletUpdate(serial?: string | null): Promise<void> {
  if (!serial) return
  try {
    await supabase
      .from('loyalty_cards')
      .update({ wallet_updated_at: new Date().toISOString() })
      .eq('qr_code', serial)

    if (!isWalletPushConfigured()) return

    const { data: regs } = await supabase
      .from('wallet_registrations')
      .select('push_token')
      .eq('serial_number', serial)

    for (const r of regs ?? []) {
      const status = await pushOne(r.push_token as string)
      // 410 = the device no longer has the pass; drop the dead registration.
      if (status === 410) {
        await supabase
          .from('wallet_registrations')
          .delete()
          .eq('serial_number', serial)
          .eq('push_token', r.push_token)
      }
    }
  } catch {
    // Never let a wallet-push failure break the calling request.
  }
}
