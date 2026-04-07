import { Router, Request, Response } from 'express'
import {
  getFixedCostsByMonth,
  insertFixedCost,
} from '../services/db'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

const router = Router()

// GET /api/fixed-costs?month=YYYY-MM
router.get('/', async (req: Request, res: Response) => {
  try {
    const month =
      (req.query.month as string) || new Date().toISOString().slice(0, 7)
    const costs = await getFixedCostsByMonth(month)
    res.json(costs)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/fixed-costs
router.post('/', async (req: Request, res: Response) => {
  try {
    const { month, category, description, amount } = req.body

    if (!month || !category || !description || amount == null) {
      res.status(400).json({ message: 'month, category, description, and amount are required' })
      return
    }

    if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ message: 'month must be YYYY-MM format' })
      return
    }

    const validCategories = ['Rent', 'Wages', 'Utilities', 'Internet', 'Insurance', 'Equipment', 'Marketing', 'Other']
    if (!validCategories.includes(category)) {
      res.status(400).json({ message: `category must be one of: ${validCategories.join(', ')}` })
      return
    }

    if (typeof description !== 'string' || description.trim().length === 0 || description.length > 200) {
      res.status(400).json({ message: 'description must be a non-empty string (max 200 chars)' })
      return
    }

    if (typeof amount !== 'number' || amount < 0) {
      res.status(400).json({ message: 'amount must be a non-negative number' })
      return
    }

    const sanitized = {
      month,
      category,
      description: description.trim(),
      amount,
      due_date: req.body.due_date && /^\d{4}-\d{2}-\d{2}$/.test(req.body.due_date) ? req.body.due_date : undefined,
      notes: req.body.notes ? String(req.body.notes).trim().slice(0, 500) : undefined,
    }

    const cost = await insertFixedCost(sanitized)
    await logAudit(req, { action: 'create', entity: 'fixed_cost', entity_id: cost.id, details: { page: 'Fixed Costs', description: sanitized.description, category: sanitized.category, amount: sanitized.amount, month: sanitized.month } })
    res.status(201).json(cost)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/fixed-costs/:id — toggle paid status
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { is_paid, paid_date } = req.body
    const updates: Record<string, any> = {}

    if (typeof is_paid === 'boolean') {
      updates.is_paid = is_paid
      updates.paid_date = is_paid ? (paid_date || new Date().toISOString().slice(0, 10)) : null
    } else {
      // Fallback: mark as paid (legacy behavior)
      updates.is_paid = true
      updates.paid_date = new Date().toISOString().slice(0, 10)
    }

    const { data, error } = await supabase
      .from('fixed_costs')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    await logAudit(req, { action: 'update', entity: 'fixed_cost', entity_id: req.params.id, details: { page: 'Fixed Costs', description: data.description, changes: updates.is_paid ? `Marked as ${updates.is_paid ? 'paid' : 'unpaid'}` : JSON.stringify(updates) } })
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/fixed-costs/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from('fixed_costs')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ message: 'Fixed cost deleted' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
