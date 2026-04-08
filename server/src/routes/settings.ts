import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

const router = Router()

// GET /api/settings/:key
router.get('/:key', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', req.params.key)
      .single()
    if (error || !data) { res.json(null); return }
    res.json(data.value)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/settings/:key
router.put('/:key', async (req: Request, res: Response) => {
  try {
    const { value } = req.body
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({ key: req.params.key, value }, { onConflict: 'key' })
      .select()
      .single()
    if (error) throw error
    await logAudit(req, { action: 'update', entity: 'menu_item', entity_id: req.params.key, details: { page: 'Settings', key: req.params.key } })
    res.json(data.value)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
