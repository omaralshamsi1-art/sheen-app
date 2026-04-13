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
// Bean substitution: if a sale item is "Americano (Brazil)", the Coffee
// ingredient in the recipe is swapped to the ingredient matching "Brazil".
router.get('/stock', async (_req: Request, res: Response) => {
  try {
    const { data: ingredients, error: ingErr } = await supabase
      .from('ingredients').select('*').order('category').order('name')
    if (ingErr) throw ingErr

    const { data: expenses, error: expErr } = await supabase
      .from('expenses').select('ingredient_name, qty_bought')
    if (expErr) throw expErr

    const { data: recipeLines, error: recErr } = await supabase
      .from('recipe_lines').select('ingredient_id, menu_item_id, qty')
    if (recErr) throw recErr

    // Get every individual sale item (need name for bean extraction)
    const { data: saleItems, error: saleErr } = await supabase
      .from('sale_items').select('menu_item_id, name, qty')
    if (saleErr) throw saleErr

    const ingredientList = ingredients ?? []
    const ingredientMap = new Map(ingredientList.map((i: any) => [i.id, i]))

    // Group recipe lines by menu_item_id for fast lookup
    const recipesByItem: Record<string, Array<{ ingredient_id: string; qty: number }>> = {}
    for (const rl of recipeLines ?? []) {
      if (!recipesByItem[rl.menu_item_id]) recipesByItem[rl.menu_item_id] = []
      recipesByItem[rl.menu_item_id].push({ ingredient_id: rl.ingredient_id, qty: Number(rl.qty) })
    }

    // Calculate usage per ingredient — process each sale item individually
    // so we can handle bean substitution from the item name.
    const usageById: Record<string, number> = {}
    for (const si of saleItems ?? []) {
      const recipe = recipesByItem[si.menu_item_id]
      if (!recipe) continue

      // Extract bean choice from name: "Americano (Ethiopia)" → "Ethiopia"
      const beanMatch = (si.name as string).match(/\(([^)]+)\)$/)
      const beanChoice = beanMatch ? beanMatch[1] : null

      for (const line of recipe) {
        let targetId = line.ingredient_id

        // Bean substitution: if this line's ingredient is Coffee-category
        // and the sale had a specific bean choice, swap the target.
        if (beanChoice) {
          const recipeIng = ingredientMap.get(line.ingredient_id)
          if (recipeIng && recipeIng.category === 'Coffee') {
            const chosenBean = ingredientList.find(
              (i: any) =>
                i.category === 'Coffee' &&
                i.name.toLowerCase().includes(beanChoice.toLowerCase())
            )
            if (chosenBean) targetId = chosenBean.id
          }
        }

        usageById[targetId] = (usageById[targetId] || 0) + line.qty * si.qty
      }
    }

    // Calculate total purchased per ingredient (match by name)
    const purchasedByName: Record<string, number> = {}
    for (const exp of expenses ?? []) {
      const name = (exp.ingredient_name as string).toLowerCase().trim()
      purchasedByName[name] = (purchasedByName[name] || 0) + Number(exp.qty_bought)
    }

    // Build stock report
    const stock = ingredientList.map((ing: any) => {
      const purchased = purchasedByName[ing.name.toLowerCase().trim()] || 0
      const used = usageById[ing.id] || 0
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
        low_stock: remaining > 0 && remaining < purchased * 0.2,
      }
    })

    res.json(stock)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
