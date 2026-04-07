import { Router, Request, Response } from 'express'
import { getIngredients } from '../services/db'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

const router = Router()

// GET /api/ingredients
router.get('/', async (_req: Request, res: Response) => {
  try {
    const ingredients = await getIngredients()
    res.json(ingredients)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/ingredients — add new ingredient
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, category, unit, pack_size, pack_cost, cost_per_unit, notes } = req.body
    if (!name || !category || !unit) {
      res.status(400).json({ message: 'name, category, and unit are required' })
      return
    }
    const { data, error } = await supabase
      .from('ingredients')
      .insert({ name, category, unit, pack_size: pack_size || null, pack_cost: pack_cost || 0, cost_per_unit: cost_per_unit || 0, notes: notes || null })
      .select()
      .single()
    if (error) throw error
    await logAudit(req, { action: 'create', entity: 'menu_item', entity_id: data.id, details: { page: 'Ingredients', ingredient: name, category, unit, cost_per_unit } })
    res.status(201).json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/ingredients/:id — update ingredient
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, category, unit, pack_size, pack_cost, cost_per_unit, notes } = req.body
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (category !== undefined) updates.category = category
    if (unit !== undefined) updates.unit = unit
    if (pack_size !== undefined) updates.pack_size = pack_size
    if (pack_cost !== undefined) updates.pack_cost = pack_cost
    if (cost_per_unit !== undefined) updates.cost_per_unit = cost_per_unit
    if (notes !== undefined) updates.notes = notes

    const { data: before } = await supabase.from('ingredients').select('name').eq('id', req.params.id).single()
    const { data, error } = await supabase
      .from('ingredients')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error

    // Also update cost in recipe_lines that use this ingredient
    if (cost_per_unit !== undefined) {
      const { data: lines } = await supabase.from('recipe_lines').select('id, qty').eq('ingredient_id', req.params.id)
      for (const line of lines ?? []) {
        await supabase.from('recipe_lines').update({ unit_cost: cost_per_unit, line_cost: line.qty * cost_per_unit }).eq('id', line.id)
      }
    }

    await logAudit(req, { action: 'update', entity: 'menu_item', entity_id: req.params.id, details: { page: 'Ingredients', ingredient: before?.name ?? data.name, changes: Object.entries(updates).filter(([k]) => k !== 'updated_at').map(([k, v]) => `${k}: ${v}`).join(', ') } })
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/ingredients/:id — delete ingredient
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { data: existing } = await supabase.from('ingredients').select('name, category').eq('id', req.params.id).single()
    // Remove recipe lines using this ingredient first
    await supabase.from('recipe_lines').delete().eq('ingredient_id', req.params.id)
    const { error } = await supabase.from('ingredients').delete().eq('id', req.params.id)
    if (error) throw error
    await logAudit(req, { action: 'delete', entity: 'menu_item', entity_id: req.params.id, details: { page: 'Ingredients', ingredient: existing?.name, category: existing?.category } })
    res.json({ message: 'Ingredient deleted' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/ingredients/stock — calculate stock levels
// Stock = total purchased (expenses) - total used (sales × recipe qty)
router.get('/stock', async (_req: Request, res: Response) => {
  try {
    // Get all ingredients
    const { data: ingredients, error: ingErr } = await supabase
      .from('ingredients')
      .select('*')
      .order('category')
      .order('name')
    if (ingErr) throw ingErr

    // Get all purchases (expenses) grouped by ingredient name
    const { data: expenses, error: expErr } = await supabase
      .from('expenses')
      .select('ingredient_name, qty_bought, unit')
    if (expErr) throw expErr

    // Get all recipe lines to know how much each sale uses
    const { data: recipes, error: recErr } = await supabase
      .from('recipe_lines')
      .select('ingredient_id, qty')
    if (recErr) throw recErr

    // Get total cups sold per menu item (all time)
    const { data: saleItems, error: saleErr } = await supabase
      .from('sale_items')
      .select('menu_item_id, qty')
    if (saleErr) throw saleErr

    // Calculate cups sold per menu item
    const cupsByItem: Record<string, number> = {}
    for (const si of saleItems ?? []) {
      cupsByItem[si.menu_item_id] = (cupsByItem[si.menu_item_id] || 0) + si.qty
    }

    // Calculate total usage per ingredient (from recipes × cups sold)
    const usageByIngredient: Record<string, number> = {}
    // We need recipe lines with menu_item_id
    const { data: fullRecipes, error: frErr } = await supabase
      .from('recipe_lines')
      .select('ingredient_id, menu_item_id, qty')
    if (frErr) throw frErr

    for (const rl of fullRecipes ?? []) {
      const cupsSold = cupsByItem[rl.menu_item_id] || 0
      const used = rl.qty * cupsSold
      usageByIngredient[rl.ingredient_id] = (usageByIngredient[rl.ingredient_id] || 0) + used
    }

    // Calculate total purchased per ingredient (match by name)
    const purchasedByName: Record<string, number> = {}
    for (const exp of expenses ?? []) {
      const name = exp.ingredient_name.toLowerCase().trim()
      purchasedByName[name] = (purchasedByName[name] || 0) + Number(exp.qty_bought)
    }

    // Build stock report
    const stock = (ingredients ?? []).map((ing: any) => {
      const purchased = purchasedByName[ing.name.toLowerCase().trim()] || 0
      const used = usageByIngredient[ing.id] || 0
      const remaining = purchased - used
      return {
        id: ing.id,
        name: ing.name,
        category: ing.category,
        unit: ing.unit,
        pack_size: ing.pack_size,
        cost_per_unit: ing.cost_per_unit,
        purchased,
        used: Math.round(used * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        low_stock: remaining < purchased * 0.2, // less than 20% remaining
      }
    })

    res.json(stock)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
