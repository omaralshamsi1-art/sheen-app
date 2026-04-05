import { Router, Request, Response } from 'express'
import { getMenuItems } from '../services/db'
import { supabase } from '../lib/supabase'

const router = Router()

// GET /api/menu
router.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await getMenuItems()
    res.json(items)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/menu/:id — update selling_price and/or is_active
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { selling_price, is_active } = req.body
    const updates: Record<string, any> = {}

    if (selling_price !== undefined) {
      if (typeof selling_price !== 'number' || selling_price < 0) {
        res.status(400).json({ message: 'selling_price must be a non-negative number' })
        return
      }
      updates.selling_price = selling_price
    }

    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        res.status(400).json({ message: 'is_active must be a boolean' })
        return
      }
      updates.is_active = is_active
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: 'No valid fields to update' })
      return
    }

    const { data, error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/menu/recalculate — recalculate gross_margin for all items
router.post('/recalculate', async (_req: Request, res: Response) => {
  try {
    const items = await getMenuItems()

    for (const item of items) {
      const gross_margin =
        item.selling_price > 0
          ? ((item.selling_price - item.estimated_cogs - item.packaging_cost) /
              item.selling_price) *
            100
          : 0

      await supabase
        .from('menu_items')
        .update({ gross_margin: Math.round(gross_margin * 100) / 100 })
        .eq('id', item.id)
    }

    const updated = await getMenuItems()
    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
