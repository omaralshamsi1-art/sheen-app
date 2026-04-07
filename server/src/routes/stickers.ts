import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

const router = Router()

// GET /api/stickers — get all active messages
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('sticker_messages')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data ?? [])
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/stickers/random — get one random active message
router.get('/random', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('sticker_messages')
      .select('*')
      .eq('is_active', true)
    if (error) throw error
    if (!data || data.length === 0) {
      res.json({ message_ar: 'شكراً لزيارتك ☕', message_en: 'Thank you for visiting' })
      return
    }
    const random = data[Math.floor(Math.random() * data.length)]
    res.json(random)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/stickers — add new message
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message_ar, message_en } = req.body
    if (!message_ar || !message_en) {
      res.status(400).json({ message: 'message_ar and message_en are required' })
      return
    }
    const { data, error } = await supabase
      .from('sticker_messages')
      .insert({ message_ar, message_en })
      .select()
      .single()
    if (error) throw error
    await logAudit(req, { action: 'create', entity: 'menu_item', entity_id: data.id, details: { page: 'Stickers', message_ar } })
    res.status(201).json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/stickers/:id — update message or toggle active
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { message_ar, message_en, is_active } = req.body
    const updates: Record<string, any> = {}
    if (message_ar !== undefined) updates.message_ar = message_ar
    if (message_en !== undefined) updates.message_en = message_en
    if (is_active !== undefined) updates.is_active = is_active

    const { data, error } = await supabase
      .from('sticker_messages')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    await logAudit(req, { action: 'update', entity: 'menu_item', entity_id: req.params.id, details: { page: 'Stickers', ...updates } })
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/stickers/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { data: existing } = await supabase.from('sticker_messages').select('message_ar').eq('id', req.params.id).single()
    const { error } = await supabase.from('sticker_messages').delete().eq('id', req.params.id)
    if (error) throw error
    await logAudit(req, { action: 'delete', entity: 'menu_item', entity_id: req.params.id, details: { page: 'Stickers', message: existing?.message_ar } })
    res.json({ message: 'Deleted' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
