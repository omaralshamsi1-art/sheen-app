import { Router, Request, Response } from 'express'
import { getSalesByDateRange, insertSale } from '../services/db'

const router = Router()

// GET /api/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req: Request, res: Response) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().slice(0, 10)
    const to = (req.query.to as string) || from
    const sales = await getSalesByDateRange(from, to)
    res.json(sales)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/sales
// Body: { sale_date, items: [...], recorded_by? }
router.post('/', async (req: Request, res: Response) => {
  try {
    const { sale_date, items, recorded_by } = req.body
    if (!sale_date || !items || !items.length) {
      res.status(400).json({ message: 'sale_date and items are required' })
      return
    }

    if (typeof sale_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sale_date)) {
      res.status(400).json({ message: 'sale_date must be YYYY-MM-DD format' })
      return
    }

    if (!Array.isArray(items)) {
      res.status(400).json({ message: 'items must be an array' })
      return
    }

    for (const item of items) {
      if (!item.menu_item_id || !item.name || typeof item.qty !== 'number' || typeof item.price !== 'number' || typeof item.total !== 'number') {
        res.status(400).json({ message: 'Each item requires menu_item_id, name, qty (number), price (number), and total (number)' })
        return
      }
      if (item.qty < 0 || item.price < 0 || item.total < 0) {
        res.status(400).json({ message: 'Item qty, price, and total must be non-negative' })
        return
      }
    }

    const sanitizedItems = items.map((item: any) => ({
      menu_item_id: String(item.menu_item_id),
      name: String(item.name).trim().slice(0, 200),
      category: item.category ? String(item.category).trim() : '',
      price: Number(item.price),
      qty: Number(item.qty),
      total: Number(item.total),
    }))

    const sale = await insertSale(
      { sale_date, recorded_by: recorded_by ? String(recorded_by).trim().slice(0, 100) : undefined },
      sanitizedItems
    )
    res.status(201).json(sale)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
