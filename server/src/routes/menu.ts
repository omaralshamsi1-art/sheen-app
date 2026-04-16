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

    const validCategories = ['Coffee', 'Matcha', 'Cold Drinks', 'Açaí', 'Desserts', 'Bites', 'Beans']
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
    await logAudit(req, { action: 'create', entity: 'menu_item', entity_id: data.id, details: { page: 'Menu', item_name: data.name, category: data.category, selling_price: data.selling_price } })
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
    await logAudit(req, { action: 'delete', entity: 'menu_item', entity_id: req.params.id, details: { page: 'Menu', item_name: existing?.name, category: existing?.category, selling_price: existing?.selling_price } })
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

    if (req.body.description !== undefined) {
      updates.description = req.body.description
    }

    if (req.body.available_beans !== undefined) {
      updates.available_beans = req.body.available_beans
    }

    if (req.body.available_milks !== undefined) {
      updates.available_milks = req.body.available_milks
    }

    if (req.body.addons !== undefined) {
      updates.addons = req.body.addons
    }

    if (req.body.show_extra_shot !== undefined) {
      updates.show_extra_shot = req.body.show_extra_shot
    }

    if (req.body.estimated_cogs !== undefined) {
      updates.estimated_cogs = Number(req.body.estimated_cogs)
    }

    if (req.body.packaging_cost !== undefined) {
      updates.packaging_cost = Number(req.body.packaging_cost)
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: 'No valid fields to update' })
      return
    }

    // Auto-recalculate margin if price/cogs/packaging changed
    if (updates.selling_price !== undefined || updates.estimated_cogs !== undefined || updates.packaging_cost !== undefined) {
      const { data: current } = await supabase.from('menu_items').select('selling_price, estimated_cogs, packaging_cost').eq('id', req.params.id).single()
      if (current) {
        const sp = updates.selling_price ?? current.selling_price
        const cogs = updates.estimated_cogs ?? current.estimated_cogs
        const pkg = updates.packaging_cost ?? current.packaging_cost
        updates.gross_margin = sp > 0 ? Math.round(((sp - cogs - pkg) / sp) * 10000) / 100 : 0
      }
    }

    // Get old values for audit
    const { data: before } = await supabase.from('menu_items').select('name, selling_price, is_active').eq('id', req.params.id).single()

    const { data, error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    await logAudit(req, { action: 'update', entity: 'menu_item', entity_id: req.params.id, details: {
      page: 'Menu',
      item_name: before?.name ?? data.name,
      changes: Object.entries(updates).map(([k, v]) => `${k}: ${(before as any)?.[k] ?? '?'} → ${v}`).join(', '),
    } })
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

// ─── RECIPE LINES ───

// GET /api/menu/:id/recipes — get recipe lines for a menu item
router.get('/:id/recipes', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('recipe_lines')
      .select('*, ingredients(name, unit, cost_per_unit)')
      .eq('menu_item_id', req.params.id)
      .order('id')

    if (error) throw error

    // Flatten ingredient info into each line
    const lines = (data ?? []).map((line: any) => ({
      id: line.id,
      menu_item_id: line.menu_item_id,
      ingredient_id: line.ingredient_id,
      ingredient_name: line.ingredients?.name ?? '',
      qty: line.qty,
      unit: line.ingredients?.unit ?? line.unit,
      unit_cost: line.ingredients?.cost_per_unit ?? line.unit_cost,
      line_cost: line.qty * (line.ingredients?.cost_per_unit ?? line.unit_cost ?? 0),
    }))

    res.json(lines)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/menu/:id/recipes — add a recipe line
router.post('/:id/recipes', async (req: Request, res: Response) => {
  try {
    const { ingredient_id, qty, unit } = req.body
    const menu_item_id = req.params.id as string

    if (!ingredient_id || !qty || qty <= 0) {
      res.status(400).json({ message: 'ingredient_id and qty (> 0) are required' })
      return
    }

    // Get ingredient cost
    const { data: ing } = await supabase
      .from('ingredients')
      .select('cost_per_unit, unit')
      .eq('id', ingredient_id)
      .single()

    const unit_cost = ing?.cost_per_unit ?? 0
    const line_cost = qty * unit_cost

    const { data, error } = await supabase
      .from('recipe_lines')
      .insert({
        menu_item_id,
        ingredient_id,
        qty,
        unit: unit || ing?.unit || '',
        unit_cost,
        line_cost,
      })
      .select()
      .single()

    if (error) throw error

    // Auto-recalculate COGS for this menu item
    await recalculateCOGS(menu_item_id)

    // Get names for audit
    const { data: menuItem } = await supabase.from('menu_items').select('name').eq('id', menu_item_id).single()
    const { data: ingInfo } = await supabase.from('ingredients').select('name, unit').eq('id', ingredient_id).single()
    await logAudit(req, { action: 'create', entity: 'menu_item', entity_id: menu_item_id, details: { page: 'Menu → Recipe', item_name: menuItem?.name, action: 'Added ingredient', ingredient: ingInfo?.name, qty: `${qty} ${ingInfo?.unit ?? ''}` } })
    res.status(201).json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/menu/:id/recipes/:lineId — remove a recipe line
router.delete('/:id/recipes/:lineId', async (req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from('recipe_lines')
      .delete()
      .eq('id', req.params.lineId)

    if (error) throw error

    // Auto-recalculate COGS for this menu item
    await recalculateCOGS(req.params.id as string)

    const { data: menuItem2 } = await supabase.from('menu_items').select('name').eq('id', req.params.id).single()
    await logAudit(req, { action: 'delete', entity: 'menu_item', entity_id: req.params.id, details: { page: 'Menu → Recipe', item_name: menuItem2?.name, action: 'Removed ingredient' } })
    res.json({ message: 'Recipe line removed' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// Helper: recalculate COGS + margin for a menu item from its recipe lines
async function recalculateCOGS(menuItemId: string) {
  const { data: lines } = await supabase
    .from('recipe_lines')
    .select('qty, unit_cost')
    .eq('menu_item_id', menuItemId)

  const estimated_cogs = (lines ?? []).reduce(
    (sum: number, l: any) => sum + (l.qty * (l.unit_cost ?? 0)), 0
  )

  const { data: item } = await supabase
    .from('menu_items')
    .select('selling_price, packaging_cost')
    .eq('id', menuItemId)
    .single()

  const selling_price = item?.selling_price ?? 0
  const packaging_cost = item?.packaging_cost ?? 0
  const gross_margin = selling_price > 0
    ? ((selling_price - estimated_cogs - packaging_cost) / selling_price) * 100
    : 0

  await supabase
    .from('menu_items')
    .update({
      estimated_cogs: Math.round(estimated_cogs * 100) / 100,
      gross_margin: Math.round(gross_margin * 100) / 100,
    })
    .eq('id', menuItemId)
}

export default router
