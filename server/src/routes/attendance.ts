import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'

const router = Router()

const RP_NAME = 'SHEEN CAFE'

function getRpInfo(req: Request) {
  const origin =
    (req.headers.origin as string | undefined) ??
    (req.headers.referer as string | undefined) ??
    ''
  let rpID = process.env.WEBAUTHN_RP_ID
  if (!rpID && origin) {
    try {
      rpID = new URL(origin).hostname
    } catch {
      rpID = 'localhost'
    }
  }
  return { rpID: rpID || 'localhost', origin }
}

function getUser(req: Request) {
  const userId = req.headers['x-user-id'] as string | undefined
  const userEmail = req.headers['x-user-email'] as string | undefined
  return { userId, userEmail }
}

function nowIso() {
  return new Date().toISOString()
}

// UAE local date (UTC+4)
function uaeToday(): string {
  const now = new Date()
  now.setHours(now.getHours() + 4)
  return now.toISOString().slice(0, 10)
}

function bufToB64Url(buf: Uint8Array | ArrayBuffer): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return Buffer.from(u8).toString('base64url')
}

function b64UrlToU8(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64url'))
}

// ─── Registration: GET /api/attendance/enroll/options ───────────────
router.post('/enroll/options', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail } = getUser(req)
    if (!userId || !userEmail) {
      res.status(401).json({ message: 'Not signed in' })
      return
    }
    const { rpID } = getRpInfo(req)

    const { data: existing } = await supabase
      .from('webauthn_credentials')
      .select('id, transports')
      .eq('user_id', userId)

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: new TextEncoder().encode(userId),
      userName: userEmail,
      userDisplayName: userEmail,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
      excludeCredentials: (existing ?? []).map((c) => ({
        id: c.id,
        transports: (c.transports ?? undefined) as any,
      })),
    })

    await supabase.from('webauthn_challenges').insert({
      user_id: userId,
      challenge: options.challenge,
      purpose: 'enroll',
    })

    res.json(options)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── Registration: POST /api/attendance/enroll/verify ────────────────
router.post('/enroll/verify', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail } = getUser(req)
    if (!userId || !userEmail) {
      res.status(401).json({ message: 'Not signed in' })
      return
    }
    const { rpID, origin } = getRpInfo(req)
    const { response, deviceLabel } = req.body

    const { data: chRows } = await supabase
      .from('webauthn_challenges')
      .select('id, challenge, created_at')
      .eq('user_id', userId)
      .eq('purpose', 'enroll')
      .order('created_at', { ascending: false })
      .limit(1)
    const expectedChallenge = chRows?.[0]?.challenge
    if (!expectedChallenge) {
      res.status(400).json({ message: 'Challenge not found — start enrollment again' })
      return
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    })

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ message: 'Verification failed' })
      return
    }

    const { credential } = verification.registrationInfo
    const credentialID = credential.id // already base64url string in v11
    const publicKey = bufToB64Url(credential.publicKey)
    const counter = credential.counter

    await supabase.from('webauthn_credentials').upsert({
      id: credentialID,
      user_id: userId,
      user_email: userEmail,
      public_key: publicKey,
      counter,
      transports: response.response?.transports ?? null,
      device_label: deviceLabel ?? req.headers['user-agent'] ?? null,
      created_at: nowIso(),
    })

    await supabase.from('webauthn_challenges').delete().eq('id', chRows[0].id)

    res.json({ verified: true })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── Authentication: POST /api/attendance/clock/options ──────────────
router.post('/clock/options', async (req: Request, res: Response) => {
  try {
    const { userId } = getUser(req)
    if (!userId) {
      res.status(401).json({ message: 'Not signed in' })
      return
    }
    const { rpID } = getRpInfo(req)

    const { data: creds } = await supabase
      .from('webauthn_credentials')
      .select('id, transports')
      .eq('user_id', userId)

    if (!creds || creds.length === 0) {
      res.status(400).json({ message: 'No biometric enrolled. Please enroll first.', code: 'NOT_ENROLLED' })
      return
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: creds.map((c) => ({
        id: c.id,
        transports: (c.transports ?? undefined) as any,
      })),
    })

    await supabase.from('webauthn_challenges').insert({
      user_id: userId,
      challenge: options.challenge,
      purpose: 'clock',
    })

    res.json(options)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── Authentication: POST /api/attendance/clock/verify ───────────────
// Body: { response, action: 'in' | 'out', userName?: string, notes?: string }
router.post('/clock/verify', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail } = getUser(req)
    if (!userId || !userEmail) {
      res.status(401).json({ message: 'Not signed in' })
      return
    }
    const { rpID, origin } = getRpInfo(req)
    const { response, action, userName, notes } = req.body
    if (action !== 'in' && action !== 'out') {
      res.status(400).json({ message: 'action must be "in" or "out"' })
      return
    }

    const { data: chRows } = await supabase
      .from('webauthn_challenges')
      .select('id, challenge')
      .eq('user_id', userId)
      .eq('purpose', 'clock')
      .order('created_at', { ascending: false })
      .limit(1)
    const expectedChallenge = chRows?.[0]?.challenge
    if (!expectedChallenge) {
      res.status(400).json({ message: 'Challenge not found' })
      return
    }

    const credentialID = response.id
    const { data: credRow } = await supabase
      .from('webauthn_credentials')
      .select('*')
      .eq('id', credentialID)
      .eq('user_id', userId)
      .single()

    if (!credRow) {
      res.status(400).json({ message: 'Unknown credential' })
      return
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: credRow.id,
        publicKey: b64UrlToU8(credRow.public_key),
        counter: Number(credRow.counter),
        transports: credRow.transports ?? undefined,
      },
    })

    if (!verification.verified) {
      res.status(400).json({ message: 'Biometric verification failed' })
      return
    }

    await supabase
      .from('webauthn_credentials')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: nowIso(),
      })
      .eq('id', credentialID)

    await supabase.from('webauthn_challenges').delete().eq('id', chRows[0].id)

    // Insert / update today's attendance row
    const today = uaeToday()
    const ts = nowIso()
    const device = (req.headers['user-agent'] as string | undefined) ?? null

    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()

    if (action === 'in') {
      if (existing?.clock_in) {
        res.status(400).json({ message: 'Already clocked in today' })
        return
      }
      if (existing) {
        await supabase
          .from('attendance')
          .update({ clock_in: ts, in_method: 'webauthn', in_device: device, updated_at: ts })
          .eq('id', existing.id)
      } else {
        await supabase.from('attendance').insert({
          user_id: userId,
          user_email: userEmail,
          user_name: userName ?? null,
          date: today,
          clock_in: ts,
          in_method: 'webauthn',
          in_device: device,
          notes: notes ?? null,
        })
      }
    } else {
      if (!existing?.clock_in) {
        res.status(400).json({ message: 'Clock in first before clocking out' })
        return
      }
      if (existing.clock_out) {
        res.status(400).json({ message: 'Already clocked out today' })
        return
      }
      await supabase
        .from('attendance')
        .update({ clock_out: ts, out_method: 'webauthn', out_device: device, updated_at: ts })
        .eq('id', existing.id)
    }

    res.json({ verified: true, action, date: today, time: ts })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET /api/attendance/me?month=YYYY-MM (or ?from=&to=) ────────────
router.get('/me', async (req: Request, res: Response) => {
  try {
    const { userId } = getUser(req)
    if (!userId) {
      res.status(401).json({ message: 'Not signed in' })
      return
    }
    const month = (req.query.month as string | undefined) ?? uaeToday().slice(0, 7)
    const from = `${month}-01`
    const last = new Date(`${month}-01T00:00:00Z`)
    last.setUTCMonth(last.getUTCMonth() + 1)
    last.setUTCDate(0)
    const to = last.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
    if (error) throw error
    res.json(data ?? [])
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET /api/attendance/admin?month=YYYY-MM ─────────────────────────
router.get('/admin', async (req: Request, res: Response) => {
  try {
    const month = (req.query.month as string | undefined) ?? uaeToday().slice(0, 7)
    const from = `${month}-01`
    const last = new Date(`${month}-01T00:00:00Z`)
    last.setUTCMonth(last.getUTCMonth() + 1)
    last.setUTCDate(0)
    const to = last.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
      .order('user_email', { ascending: true })
    if (error) throw error
    res.json(data ?? [])
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET /api/attendance/credentials/me ──────────────────────────────
router.get('/credentials/me', async (req: Request, res: Response) => {
  try {
    const { userId } = getUser(req)
    if (!userId) {
      res.status(401).json({ message: 'Not signed in' })
      return
    }
    const { data, error } = await supabase
      .from('webauthn_credentials')
      .select('id, device_label, created_at, last_used_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data ?? [])
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── DELETE /api/attendance/credentials/:id ──────────────────────────
router.delete('/credentials/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = getUser(req)
    if (!userId) {
      res.status(401).json({ message: 'Not signed in' })
      return
    }
    const { error } = await supabase
      .from('webauthn_credentials')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', userId)
    if (error) throw error
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
