import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import crypto from 'crypto'

const router = Router()

const VISITS_FOR_FREE_CUP = 6

// GET /api/loyalty/my-card — get or create loyalty card for current user
router.get('/my-card', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string
    const email = req.query.email as string
    const name = req.query.name as string

    if (!userId) { res.status(400).json({ message: 'user_id required' }); return }

    // Try to find existing card
    const { data: existing } = await supabase
      .from('loyalty_cards')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (existing) { res.json(existing); return }

    // Create new card with unique QR code
    const qr_code = `SHEEN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`

    const { data, error } = await supabase
      .from('loyalty_cards')
      .insert({ user_id: userId, email: email || null, name: name || null, qr_code })
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/loyalty/scan/:qrCode — staff looks up card by QR code
router.get('/scan/:qrCode', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('loyalty_cards')
      .select('*')
      .eq('qr_code', req.params.qrCode)
      .single()

    if (error || !data) { res.status(404).json({ message: 'Card not found' }); return }

    const visits_toward_free = data.total_visits % VISITS_FOR_FREE_CUP
    const free_cups_available = data.free_cups_earned - data.free_cups_used

    res.json({
      ...data,
      visits_toward_free,
      visits_remaining: VISITS_FOR_FREE_CUP - visits_toward_free,
      free_cups_available,
      visits_for_free_cup: VISITS_FOR_FREE_CUP,
    })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/loyalty/add-visit — staff adds a visit after scanning
router.post('/add-visit', async (req: Request, res: Response) => {
  try {
    const { qr_code } = req.body
    if (!qr_code) { res.status(400).json({ message: 'qr_code required' }); return }

    // Find card
    const { data: card, error: findErr } = await supabase
      .from('loyalty_cards')
      .select('*')
      .eq('qr_code', qr_code)
      .single()

    if (findErr || !card) { res.status(404).json({ message: 'Card not found' }); return }

    // Add visit record
    const staffEmail = req.headers['x-user-email'] as string || 'staff'
    await supabase.from('loyalty_visits').insert({
      card_id: card.id,
      recorded_by: staffEmail,
      visit_type: 'visit',
    })

    // Update totals
    const newVisits = card.total_visits + 1
    const newFreeCups = Math.floor(newVisits / VISITS_FOR_FREE_CUP)

    const { data: updated, error: updateErr } = await supabase
      .from('loyalty_cards')
      .update({ total_visits: newVisits, free_cups_earned: newFreeCups })
      .eq('id', card.id)
      .select()
      .single()

    if (updateErr) throw updateErr

    const earnedFree = newVisits % VISITS_FOR_FREE_CUP === 0

    await logAudit(req, { action: 'create', entity: 'order', entity_id: card.id, details: { page: 'Loyalty', customer: card.name || card.email, visit_number: newVisits, earned_free_cup: earnedFree } })

    res.json({
      ...updated,
      visits_toward_free: newVisits % VISITS_FOR_FREE_CUP,
      visits_remaining: VISITS_FOR_FREE_CUP - (newVisits % VISITS_FOR_FREE_CUP),
      free_cups_available: newFreeCups - card.free_cups_used,
      earned_free_cup: earnedFree,
      visits_for_free_cup: VISITS_FOR_FREE_CUP,
    })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/loyalty/redeem — staff redeems a free cup
router.post('/redeem', async (req: Request, res: Response) => {
  try {
    const { qr_code } = req.body
    if (!qr_code) { res.status(400).json({ message: 'qr_code required' }); return }

    const { data: card, error: findErr } = await supabase
      .from('loyalty_cards')
      .select('*')
      .eq('qr_code', qr_code)
      .single()

    if (findErr || !card) { res.status(404).json({ message: 'Card not found' }); return }

    const available = card.free_cups_earned - card.free_cups_used
    if (available <= 0) { res.status(400).json({ message: 'No free cups available' }); return }

    await supabase.from('loyalty_visits').insert({
      card_id: card.id,
      recorded_by: req.headers['x-user-email'] as string || 'staff',
      visit_type: 'redeem',
    })

    const { data: updated, error: updateErr } = await supabase
      .from('loyalty_cards')
      .update({ free_cups_used: card.free_cups_used + 1 })
      .eq('id', card.id)
      .select()
      .single()

    if (updateErr) throw updateErr

    await logAudit(req, { action: 'update', entity: 'order', entity_id: card.id, details: { page: 'Loyalty', customer: card.name || card.email, action: 'Free cup redeemed' } })

    res.json({ ...updated, free_cups_available: updated.free_cups_earned - updated.free_cups_used, visits_for_free_cup: VISITS_FOR_FREE_CUP })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
