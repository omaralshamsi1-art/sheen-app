import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { isRequesterAdmin } from '../lib/auth'
import { isPushConfigured, sendToAll } from '../lib/push'

const router = Router()

// GET /api/push/status — is push configured on the server?
router.get('/status', (_req: Request, res: Response) => {
  res.json({ configured: isPushConfigured() })
})

// POST /api/push/register — store a device token for the current user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { token, platform } = req.body
    if (!token || typeof token !== 'string') {
      res.status(400).json({ message: 'token required' })
      return
    }
    const userId = (req.headers['x-user-id'] as string) || null

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        { token, platform: platform ?? null, user_id: userId, updated_at: new Date().toISOString() },
        { onConflict: 'token' },
      )
    if (error) throw error

    // Keep a single token per user/platform: drop this user's older tokens for
    // the same platform so a device's rotated/duplicate tokens don't pile up
    // (which would otherwise deliver the same notification more than once).
    if (userId) {
      await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('platform', platform ?? null)
        .neq('token', token)
    }

    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/push/unregister — remove a device token (e.g. on logout)
router.post('/unregister', async (req: Request, res: Response) => {
  try {
    const { token } = req.body
    if (!token) { res.status(400).json({ message: 'token required' }); return }
    await supabase.from('push_tokens').delete().eq('token', token)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/push/send — broadcast a notification to all customers (admin only)
router.post('/send', async (req: Request, res: Response) => {
  try {
    if (!(await isRequesterAdmin(req))) {
      res.status(403).json({ message: 'Admin only' })
      return
    }
    if (!isPushConfigured()) {
      res.status(501).json({ message: 'Push notifications are not set up yet', configured: false })
      return
    }

    const title = String(req.body.title ?? '').trim()
    const body = String(req.body.body ?? '').trim()
    if (!title || !body) {
      res.status(400).json({ message: 'title and body are required' })
      return
    }

    const result = await sendToAll(title.slice(0, 100), body.slice(0, 240))
    await logAudit(req, {
      action: 'create',
      entity: 'order',
      entity_id: 'push-campaign',
      details: { page: 'Settings', type: 'Push campaign', title, ...result },
    })
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
