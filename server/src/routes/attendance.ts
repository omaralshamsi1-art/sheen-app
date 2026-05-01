import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { supabase } from '../lib/supabase'
import Groq from 'groq-sdk'

const router = Router()
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// UAE local date (UTC+4)
function uaeToday(): string {
  const now = new Date()
  now.setHours(now.getHours() + 4)
  return now.toISOString().slice(0, 10)
}
function nowIso() {
  return new Date().toISOString()
}

function getKioskToken(req: Request): string | undefined {
  const h = req.headers['x-kiosk-token']
  return Array.isArray(h) ? h[0] : (h as string | undefined)
}

async function verifyKiosk(req: Request): Promise<boolean> {
  const token = getKioskToken(req)
  if (!token) return false
  const { data } = await supabase
    .from('kiosk_tokens')
    .select('token, is_active')
    .eq('token', token)
    .maybeSingle()
  if (!data || !data.is_active) return false
  await supabase.from('kiosk_tokens').update({ last_used_at: nowIso() }).eq('token', token)
  return true
}

// ─── POST /api/attendance/kiosk/register ─────────────────────────────
// Admin (or anyone signed-in admin) registers the current device as a kiosk.
// Returns a token to save in localStorage.
router.post('/kiosk/register', async (req: Request, res: Response) => {
  try {
    const userEmail = req.headers['x-user-email'] as string | undefined
    const userId = req.headers['x-user-id'] as string | undefined
    if (!userId || !userEmail) {
      res.status(401).json({ message: 'Not signed in' })
      return
    }

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
    if (roleRow?.role !== 'admin') {
      res.status(403).json({ message: 'Only admin can register a kiosk device' })
      return
    }

    const token = crypto.randomBytes(24).toString('base64url')
    const label =
      typeof req.body?.label === 'string' && req.body.label.trim()
        ? String(req.body.label).trim().slice(0, 100)
        : 'Shop Kiosk'

    const { data, error } = await supabase
      .from('kiosk_tokens')
      .insert({
        token,
        label,
        user_agent: (req.headers['user-agent'] as string | undefined) ?? null,
        registered_by_email: userEmail,
        is_active: true,
      })
      .select()
      .single()
    if (error) throw error

    res.json({ token: data.token, label: data.label })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET /api/attendance/kiosk/check ─────────────────────────────────
router.get('/kiosk/check', async (req: Request, res: Response) => {
  const ok = await verifyKiosk(req)
  res.json({ ok })
})

// ─── GET /api/attendance/kiosk/staff ─────────────────────────────────
// Returns staff (admin + staff roles) with id, name, email, photo_url.
// PIN value is NOT returned. Requires kiosk token.
router.get('/kiosk/staff', async (req: Request, res: Response) => {
  try {
    if (!(await verifyKiosk(req))) {
      res.status(401).json({ message: 'Kiosk token invalid' })
      return
    }
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, email, full_name, role, photo_url, attendance_pin')
      .in('role', ['admin', 'staff'])
      .order('full_name', { ascending: true })
    if (error) throw error
    const list = (data ?? []).map((u: any) => ({
      user_id: u.user_id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      photo_url: u.photo_url,
      has_pin: !!u.attendance_pin,
    }))
    res.json(list)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── POST /api/attendance/kiosk/clock ────────────────────────────────
// Body: { user_id, pin, action: 'in'|'out', selfie?: <base64 data URL>, skip_face?: boolean }
router.post('/kiosk/clock', async (req: Request, res: Response) => {
  try {
    if (!(await verifyKiosk(req))) {
      res.status(401).json({ message: 'Kiosk token invalid' })
      return
    }
    const { user_id, pin, action, selfie, skip_face } = req.body
    if (!user_id || !pin || !action) {
      res.status(400).json({ message: 'user_id, pin, action are required' })
      return
    }
    if (action !== 'in' && action !== 'out') {
      res.status(400).json({ message: 'action must be in or out' })
      return
    }

    const { data: user } = await supabase
      .from('user_roles')
      .select('user_id, email, full_name, photo_url, attendance_pin')
      .eq('user_id', user_id)
      .maybeSingle()

    if (!user) {
      res.status(404).json({ message: 'Staff not found' })
      return
    }
    if (!user.attendance_pin) {
      res.status(400).json({ message: 'No PIN set for this staff. Ask admin to set it first.', code: 'NO_PIN' })
      return
    }
    const pinMatch = String(pin).trim() === String(user.attendance_pin).trim()

    let faceMatch = true
    let faceConfidence = 0
    let faceReason: string | null = null

    if (pinMatch && !skip_face && user.photo_url && selfie) {
      try {
        const aiRes = await groq.chat.completions.create({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Two photos. Photo A is a saved reference of an employee. Photo B is a live selfie from a check-in kiosk. Decide if the SAME PERSON appears in both.

Respond ONLY with valid JSON:
{"match": true|false, "confidence": 0-100, "reason": "short reason"}

Be tolerant of lighting, angle, age, glasses, beard, mask. Only respond match=false if you are clearly confident they are different people.`,
                },
                { type: 'image_url', image_url: { url: user.photo_url } },
                { type: 'image_url', image_url: { url: selfie } },
              ],
            },
          ],
        })
        const content = aiRes.choices[0]?.message?.content ?? ''
        const m = content.match(/\{[\s\S]*\}/)
        if (m) {
          const parsed = JSON.parse(m[0])
          faceMatch = !!parsed.match
          faceConfidence = Number(parsed.confidence ?? 0)
          faceReason = parsed.reason ?? null
        }
      } catch (e: any) {
        faceMatch = true // do not block on AI failure
        faceReason = `AI error: ${e?.message ?? 'unknown'}`
      }
    } else if (!user.photo_url) {
      faceMatch = true
      faceReason = 'No reference photo on file — face check skipped'
    } else if (!selfie) {
      faceMatch = true
      faceReason = 'No selfie provided — face check skipped'
    }

    // Audit every attempt (pass or fail)
    await supabase.from('attendance_verify_log').insert({
      user_id: user.user_id,
      user_email: user.email,
      action,
      pin_match: pinMatch,
      face_match: faceMatch,
      face_confidence: faceConfidence,
      face_reason: faceReason,
      kiosk_token: getKioskToken(req),
      ip: (req.headers['x-forwarded-for'] as string | undefined) ?? req.ip ?? null,
    })

    if (!pinMatch) {
      res.status(401).json({ message: 'Wrong PIN', code: 'BAD_PIN' })
      return
    }
    if (!faceMatch) {
      res.status(403).json({
        message: `Face does not match the reference photo (${faceReason ?? 'no reason'})`,
        code: 'FACE_MISMATCH',
        confidence: faceConfidence,
      })
      return
    }

    // Write attendance row
    const today = uaeToday()
    const ts = nowIso()
    const device = (req.headers['user-agent'] as string | undefined) ?? null
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.user_id)
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
          .update({ clock_in: ts, in_method: 'kiosk', in_device: device, updated_at: ts })
          .eq('id', existing.id)
      } else {
        await supabase.from('attendance').insert({
          user_id: user.user_id,
          user_email: user.email,
          user_name: user.full_name,
          date: today,
          clock_in: ts,
          in_method: 'kiosk',
          in_device: device,
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
        .update({ clock_out: ts, out_method: 'kiosk', out_device: device, updated_at: ts })
        .eq('id', existing.id)
    }

    res.json({ ok: true, action, time: ts, name: user.full_name ?? user.email, faceConfidence })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET /api/attendance/me?month=YYYY-MM ────────────────────────────
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string | undefined
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

// ─── GET /api/attendance/kiosks (admin) ──────────────────────────────
router.get('/kiosks', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string | undefined
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
    if (roleRow?.role !== 'admin') {
      res.status(403).json({ message: 'Admin only' })
      return
    }
    const { data, error } = await supabase
      .from('kiosk_tokens')
      .select('token, label, registered_by_email, registered_at, last_used_at, is_active')
      .order('registered_at', { ascending: false })
    if (error) throw error
    res.json(data ?? [])
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── DELETE /api/attendance/kiosks/:token (admin) ────────────────────
router.delete('/kiosks/:token', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string | undefined
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
    if (roleRow?.role !== 'admin') {
      res.status(403).json({ message: 'Admin only' })
      return
    }
    const { error } = await supabase.from('kiosk_tokens').delete().eq('token', req.params.token)
    if (error) throw error
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
