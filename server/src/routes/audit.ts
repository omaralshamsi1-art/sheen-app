import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// GET /api/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&entity=sale&action=delete&email=staff@...&limit=100
router.get('/', async (req: Request, res: Response) => {
  try {
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    const entity = req.query.entity as string | undefined
    const action = req.query.action as string | undefined
    const email = req.query.email as string | undefined
    const limit = parseInt(req.query.limit as string) || 100

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (from) query = query.gte('created_at', `${from}T00:00:00`)
    if (to) query = query.lte('created_at', `${to}T23:59:59`)
    if (entity) query = query.eq('entity', entity)
    if (action) query = query.eq('action', action)
    if (email) query = query.ilike('user_email', `%${email}%`)

    const { data, error } = await query
    if (error) throw error
    res.json(data ?? [])
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
