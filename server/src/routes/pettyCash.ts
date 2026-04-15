import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// GET /api/petty-cash
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('petty_cash_transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('recorded_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/petty-cash
router.post('/', async (req: Request, res: Response) => {
  try {
    const { type, amount, description, category, date, notes, added_by, receipt_url } = req.body

    if (!type || !['deposit', 'withdrawal'].includes(type)) {
      res.status(400).json({ message: 'type must be deposit or withdrawal' })
      return
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      res.status(400).json({ message: 'amount must be a positive number' })
      return
    }
    if (!description || !String(description).trim()) {
      res.status(400).json({ message: 'description is required' })
      return
    }

    const { data, error } = await supabase
      .from('petty_cash_transactions')
      .insert({
        type: String(type),
        amount: Number(amount),
        description: String(description).trim().slice(0, 200),
        category: category ? String(category).trim() : null,
        date: date || new Date().toISOString().slice(0, 10),
        notes: notes ? String(notes).trim() : null,
        added_by: added_by ? String(added_by).trim() : null,
        receipt_url: receipt_url ? String(receipt_url).trim().slice(0, 500) : null,
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/petty-cash/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from('petty_cash_transactions')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
