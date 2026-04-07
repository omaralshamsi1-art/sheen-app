import { Router, Request, Response } from 'express'
import { getMenuItems } from '../services/db'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

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

// POST /api/menu — add a new menu item
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, category, selling_price, estimated_cogs, packaging_cost, image_url } = req.body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ message: 'name is required' })
      return
    }

    const validCategories = ['Coffee', 'Matcha', 'Cold Drinks', 'Açaí', 'Desserts', 'Bites']
    if (!category || !validCategories.includes(category)) {
      res.status(400).json({ message: `category must be one of: ${validCategories.join(', ')}` })
      return
    }

    if (typeof selling_price !== 'number' || selling_price < 0) {
      res.status(400).json({ message: 'selling_price must be a non-negative number' })
      return
    }

    const cogs = typeof estimated_cogs === 'number' ? estimated_cogs : 0
    const pkg = typeof packaging_cost === 'number' ? packaging_cost : 0
    const gross_margin = selling_price > 0
      ? ((selling_price - cogs - pkg) / selling_price) * 100
      : 0

    // Generate id from name if not provided
    const itemId = id || name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        id: itemId,
        name: name.trim(),
        category,
        selling_price,
        estimated_cogs: cogs,
        packaging_cost: pkg,
        gross_margin: Math.round(gross_margin * 100) / 100,
        is_active: true,
        ...(image_url ? { image_url } : {}),
      })
      .select()
      .single()

    if (error) throw error
    await logAudit(req, { action: 'create', entity: 'menu_item', entity_id: data.id, details: { name: data.name, category: data.category, selling_price: data.selling_price } })
    res.status(201).json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/menu/:id — delete a menu item
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { data: existing } = await supabase.from('menu_items').select('name, category, selling_price').eq('id', req.params.id).single()
    const { error } = await supabase.from('menu_items').delete().eq('id', req.params.id)
    if (error) throw error
    await logAudit(req, { action: 'delete', entity: 'menu_item', entity_id: req.params.id, details: existing ?? undefined })
    res.json({ message: 'Menu item deleted' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/menu/:id — update selling_price and/or is_active
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { selling_price, is_active, image_url } = req.body
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

    if (image_url !== undefined) {
      updates.image_url = image_url
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
    await logAudit(req, { action: 'update', entity: 'menu_item', entity_id: req.params.id, details: updates })
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
