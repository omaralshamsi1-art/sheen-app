import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { insertSale } from '../services/db'
import crypto from 'crypto'
import {
  isAppleWalletConfigured,
  isGoogleWalletConfigured,
  generateApplePass,
  buildGoogleSaveUrl,
} from '../lib/wallet'

const router = Router()

const DEFAULT_VISITS_FOR_FREE_CUP = 6

// Admin-configurable loyalty threshold (app_settings key: loyalty_visits_for_free)
export async function getVisitsForFreeCup(): Promise<number> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'loyalty_visits_for_free')
      .single()
    const n = Number(data?.value)
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_VISITS_FOR_FREE_CUP
  } catch {
    return DEFAULT_VISITS_FOR_FREE_CUP
  }
}

// Find a user's loyalty card, creating one (with a unique QR code) if needed
async function getOrCreateCard(userId: string, email?: string, name?: string) {
  const { data: existing } = await supabase
    .from('loyalty_cards')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (existing) return existing

  const qr_code = `SHEEN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`
  const { data, error } = await supabase
    .from('loyalty_cards')
    .insert({ user_id: userId, email: email || null, name: name || null, qr_code })
    .select()
    .single()

  if (error) throw error
  return data
}

// GET /api/loyalty/my-card — get or create loyalty card for current user
router.get('/my-card', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string
    if (!userId) { res.status(400).json({ message: 'user_id required' }); return }

    const card = await getOrCreateCard(userId, req.query.email as string, req.query.name as string)
    res.json(card)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/loyalty/wallet/status — which wallet providers are configured
router.get('/wallet/status', (_req: Request, res: Response) => {
  res.json({ apple: isAppleWalletConfigured(), google: isGoogleWalletConfigured() })
})

// GET /api/loyalty/wallet/apple — download the signed .pkpass for Apple Wallet
router.get('/wallet/apple', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string
    if (!userId) { res.status(400).json({ message: 'user_id required' }); return }
    if (!isAppleWalletConfigured()) {
      res.status(501).json({ message: 'Apple Wallet is not set up yet', configured: false })
      return
    }

    const card = await getOrCreateCard(userId, req.query.email as string, req.query.name as string)
    const buffer = await generateApplePass(card, await getVisitsForFreeCup())

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass')
    res.setHeader('Content-Disposition', 'attachment; filename="sheen-loyalty.pkpass"')
    res.send(buffer)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/loyalty/wallet/google — get the "Save to Google Wallet" URL
router.get('/wallet/google', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string
    if (!userId) { res.status(400).json({ message: 'user_id required' }); return }
    if (!isGoogleWalletConfigured()) {
      res.status(501).json({ message: 'Google Wallet is not set up yet', configured: false })
      return
    }

    const card = await getOrCreateCard(userId, req.query.email as string, req.query.name as string)
    res.json({ saveUrl: buildGoogleSaveUrl(card, await getVisitsForFreeCup()) })
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

    const visitsForFree = await getVisitsForFreeCup()
    const visits_toward_free = data.total_visits % visitsForFree
    const free_cups_available = data.free_cups_earned - data.free_cups_used

    res.json({
      ...data,
      visits_toward_free,
      visits_remaining: visitsForFree - visits_toward_free,
      free_cups_available,
      visits_for_free_cup: visitsForFree,
    })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/loyalty/order-visit — staff attaches the items of a walk-up / drive-
// through CASH order to the scanned customer. Creates a completed order on the
// customer's record, records the sale, and adds one loyalty visit.
router.post('/order-visit', async (req: Request, res: Response) => {
  try {
    const { qr_code, items, payment_method } = req.body
    if (!qr_code) { res.status(400).json({ message: 'qr_code required' }); return }
    // Staff pick how the walk-up / drive-through customer paid so the revenue
    // lands in the right Sales-by-source bucket ('Cash' or 'Card').
    const isCard = String(payment_method).toLowerCase() === 'card'
    const paySource = isCard ? 'Card' : 'Cash'
    const payLabel = isCard ? 'Card' : 'Cash'
    if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ message: 'items array is required' }); return }
    for (const it of items) {
      if (!it.menu_item_id || !it.name || typeof it.qty !== 'number' || typeof it.price !== 'number') {
        res.status(400).json({ message: 'Each item requires menu_item_id, name, qty, and price' }); return
      }
    }

    // Find card
    const { data: card, error: findErr } = await supabase
      .from('loyalty_cards')
      .select('*')
      .eq('qr_code', qr_code)
      .single()
    if (findErr || !card) { res.status(404).json({ message: 'Card not found' }); return }

    const total_amount = items.reduce((s: number, i: any) => s + i.price * i.qty, 0)

    // Create the order on the customer's record, already completed (cash paid)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id: card.user_id,
        customer_email: card.email,
        customer_name: card.name,
        status: 'completed',
        total_amount,
        notes: `[Payment: ${payLabel} - Drive-through]`,
      })
      .select()
      .single()
    if (orderErr) throw orderErr

    const orderItems = items.map((i: any) => ({
      order_id: order.id,
      menu_item_id: String(i.menu_item_id),
      name: String(i.name).trim(),
      price: Number(i.price),
      qty: Number(i.qty),
      total: Number(i.price) * Number(i.qty),
    }))
    await supabase.from('order_items').insert(orderItems)

    // Record the sale so the revenue shows in Dashboard / Reports
    try {
      await insertSale(
        { sale_date: new Date().toISOString().slice(0, 10), recorded_by: paySource, order_id: order.id, notes: `${payLabel} order (drive-through)` },
        orderItems.map((i: any) => ({ menu_item_id: i.menu_item_id, name: i.name, category: '', price: i.price, qty: i.qty, total: i.total })),
      )
    } catch { /* don't block on sale recording */ }

    // Add the loyalty visit (de-duped per order)
    const staffEmail = req.headers['x-user-email'] as string || 'staff'
    await supabase.from('loyalty_visits').insert({
      card_id: card.id,
      recorded_by: `order:${order.id}`,
      visit_type: 'visit',
    })

    const visitsForFree = await getVisitsForFreeCup()
    const newVisits = card.total_visits + 1
    const newFreeCups = Math.floor(newVisits / visitsForFree)

    const { data: updated, error: updateErr } = await supabase
      .from('loyalty_cards')
      .update({ total_visits: newVisits, free_cups_earned: newFreeCups })
      .eq('id', card.id)
      .select()
      .single()
    if (updateErr) throw updateErr

    const earnedFree = newVisits % visitsForFree === 0

    await logAudit(req, { action: 'create', entity: 'order', entity_id: order.id, details: { page: 'Loyalty', customer: card.name || card.email, items: orderItems.map((i: any) => `${i.name} x${i.qty}`).join(', '), total_amount, visit_number: newVisits } })

    res.json({
      ...updated,
      visits_toward_free: newVisits % visitsForFree,
      visits_remaining: visitsForFree - (newVisits % visitsForFree),
      free_cups_available: newFreeCups - card.free_cups_used,
      earned_free_cup: earnedFree,
      visits_for_free_cup: visitsForFree,
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

    res.json({ ...updated, free_cups_available: updated.free_cups_earned - updated.free_cups_used, visits_for_free_cup: await getVisitsForFreeCup() })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
