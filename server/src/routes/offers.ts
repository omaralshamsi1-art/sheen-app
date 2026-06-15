import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { isRequesterAdmin } from '../lib/auth'

const router = Router()

const VALID_CATEGORIES = ['Coffee', 'Matcha', 'Cold Drinks', 'Açaí', 'Desserts', 'Bites', 'Beans']

// GET /api/offers — active offers (public, for the customer Offers tab).
// GET /api/offers?all=1 — every offer incl. inactive (admin only).
router.get('/', async (req: Request, res: Response) => {
  try {
    const wantAll = req.query.all === '1' || req.query.all === 'true'
    if (wantAll && !(await isRequesterAdmin(req))) {
      res.status(403).json({ message: 'Admin only' })
      return
    }
    let query = supabase.from('offers').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    if (!wantAll) query = query.eq('is_active', true)
    const { data, error } = await query
    if (error) throw error
    res.json(data ?? [])
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

function validate(body: any): string | null {
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) return 'name is required'
  if (typeof body.price !== 'number' || body.price < 0) return 'price must be a non-negative number'
  if (body.original_price != null && (typeof body.original_price !== 'number' || body.original_price < 0)) return 'original_price must be a non-negative number'
  if (body.category && !VALID_CATEGORIES.includes(body.category)) return `category must be one of: ${VALID_CATEGORIES.join(', ')}`
  return null
}

function strList(v: any): string[] {
  return Array.isArray(v) ? v.filter((x: any) => typeof x === 'string' && x).map(String) : []
}

function row(body: any) {
  const ids = strList(body.menu_item_ids).length ? strList(body.menu_item_ids) : (body.menu_item_id ? [String(body.menu_item_id)] : [])
  const slots = Array.isArray(body.slots)
    ? body.slots
        .map((s: any) => ({ label: typeof s?.label === 'string' ? s.label.trim() : '', options: strList(s?.options) }))
        .filter((s: any) => s.options.length > 0)
    : []
  const dp = body.discount_percent
  const discount_percent = typeof dp === 'number' && dp > 0 ? Math.min(100, dp) : null
  return {
    name: String(body.name).trim(),
    description: body.description ? String(body.description).trim() : null,
    price: Number(body.price) || 0,
    original_price: body.original_price != null ? Number(body.original_price) : null,
    discount_percent,
    image_url: body.image_url ? String(body.image_url) : null,
    category: body.category && VALID_CATEGORIES.includes(body.category) ? body.category : 'Coffee',
    menu_item_ids: ids,
    menu_item_id: ids[0] ?? slots[0]?.options[0] ?? null, // legacy column: first usable item
    slots,
    is_active: body.is_active !== false,
    sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
  }
}

// POST /api/offers — create (admin)
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!(await isRequesterAdmin(req))) { res.status(403).json({ message: 'Admin only' }); return }
    const err = validate(req.body)
    if (err) { res.status(400).json({ message: err }); return }
    const { data, error } = await supabase.from('offers').insert(row(req.body)).select().single()
    if (error) throw error
    await logAudit(req, { action: 'create', entity: 'order', entity_id: data.id, details: { page: 'Offers', type: 'Offer', name: data.name } })
    res.status(201).json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/offers/:id — update (admin)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!(await isRequesterAdmin(req))) { res.status(403).json({ message: 'Admin only' }); return }
    const err = validate(req.body)
    if (err) { res.status(400).json({ message: err }); return }
    const { data, error } = await supabase.from('offers').update(row(req.body)).eq('id', req.params.id).select().single()
    if (error) throw error
    await logAudit(req, { action: 'update', entity: 'order', entity_id: req.params.id, details: { page: 'Offers', type: 'Offer', name: data?.name } })
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/offers/:id — delete (admin)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!(await isRequesterAdmin(req))) { res.status(403).json({ message: 'Admin only' }); return }
    const { error } = await supabase.from('offers').delete().eq('id', req.params.id)
    if (error) throw error
    await logAudit(req, { action: 'delete', entity: 'order', entity_id: req.params.id, details: { page: 'Offers', type: 'Offer' } })
    res.json({ message: 'Offer deleted' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
