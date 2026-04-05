import { Router, Request, Response } from 'express'
import { getExpensesByDateRange, insertExpense } from '../services/db'

const router = Router()

// GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD&category=Coffee
router.get('/', async (req: Request, res: Response) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().slice(0, 10)
    const to = (req.query.to as string) || from
    let expenses = await getExpensesByDateRange(from, to)

    const category = req.query.category as string | undefined
    if (category) {
      expenses = expenses.filter((e) => e.category === category)
    }

    res.json(expenses)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/expenses
router.post('/', async (req: Request, res: Response) => {
  try {
    const { expense_date, ingredient_name, category, qty_bought, unit_cost, total_cost } = req.body

    if (!expense_date || !ingredient_name || !category || qty_bought == null || unit_cost == null || total_cost == null) {
      res.status(400).json({ message: 'expense_date, ingredient_name, category, qty_bought, unit_cost, and total_cost are required' })
      return
    }

    if (typeof expense_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
      res.status(400).json({ message: 'expense_date must be YYYY-MM-DD format' })
      return
    }

    if (typeof ingredient_name !== 'string' || ingredient_name.trim().length === 0 || ingredient_name.length > 200) {
      res.status(400).json({ message: 'ingredient_name must be a non-empty string (max 200 chars)' })
      return
    }

    if (typeof qty_bought !== 'number' || qty_bought < 0) {
      res.status(400).json({ message: 'qty_bought must be a non-negative number' })
      return
    }

    if (typeof unit_cost !== 'number' || unit_cost < 0) {
      res.status(400).json({ message: 'unit_cost must be a non-negative number' })
      return
    }

    if (typeof total_cost !== 'number' || total_cost < 0) {
      res.status(400).json({ message: 'total_cost must be a non-negative number' })
      return
    }

    const sanitized = {
      expense_date,
      ingredient_name: ingredient_name.trim(),
      category: String(category).trim() as import('../types').IngredientCategory,
      supplier: req.body.supplier ? String(req.body.supplier).trim().slice(0, 200) : undefined,
      unit: req.body.unit ? String(req.body.unit).trim().slice(0, 50) : undefined,
      qty_bought,
      unit_cost,
      total_cost,
      notes: req.body.notes ? String(req.body.notes).trim().slice(0, 500) : undefined,
      added_by: req.body.added_by ? String(req.body.added_by).trim().slice(0, 100) : undefined,
    }

    const expense = await insertExpense(sanitized)
    res.status(201).json(expense)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
