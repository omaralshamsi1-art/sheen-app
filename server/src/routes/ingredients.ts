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

    // Paginate sale_items — Supabase caps each call at 1000 rows by default
    const saleItems: Array<{ menu_item_id: string; name: string; qty: number }> = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data: page, error: saleErr } = await supabase
        .from('sale_items')
        .select('menu_item_id, name, qty')
        .range(from, from + PAGE - 1)
      if (saleErr) throw saleErr
      if (!page || page.length === 0) break
      saleItems.push(...page)
      if (page.length < PAGE) break
    }

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

      // Extract bean choice from parentheses: "Americano (Ethiopia)" → "Ethiopia"
      const beanMatch = (si.name as string).match(/\(([^)]+)\)/)
      const beanChoice = beanMatch ? beanMatch[1] : null
      // Extract milk choice from brackets: "Latte (Ethiopia) [Oat Milk]" → "Oat Milk"
      const milkMatch = (si.name as string).match(/\[([^\]]+)\]/)
      const milkChoice = milkMatch ? milkMatch[1] : null

      for (const line of recipe) {
        let targetId = line.ingredient_id
        const recipeIng = ingredientMap.get(line.ingredient_id)

        // Bean substitution: Coffee-category ingredient swapped to chosen bean
        if (beanChoice && recipeIng && recipeIng.category === 'Coffee') {
          const chosenBean = ingredientList.find(
            (i: any) =>
              i.category === 'Coffee' &&
              i.name.toLowerCase().includes(beanChoice.toLowerCase())
          )
          if (chosenBean) targetId = chosenBean.id
        }

        // Milk substitution: Dairy-category ingredient swapped to chosen milk
        if (milkChoice && recipeIng && recipeIng.category === 'Dairy') {
          const chosenMilk = ingredientList.find(
            (i: any) =>
              i.category === 'Dairy' &&
              i.name.toLowerCase().includes(milkChoice.toLowerCase())
          )
          if (chosenMilk) targetId = chosenMilk.id
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

// GET /api/ingredients/bean-reconciliation
// Per-bean audit: purchased, grams used, cups sold, breakdown by drink.
router.get('/bean-reconciliation', async (_req: Request, res: Response) => {
  try {
    const { data: ingredients, error: ingErr } = await supabase
      .from('ingredients').select('*').eq('category', 'Coffee').order('name')
    if (ingErr) throw ingErr

    const { data: allIngredients, error: allErr } = await supabase
      .from('ingredients').select('id, name, category')
    if (allErr) throw allErr

    const { data: expenses, error: expErr } = await supabase
      .from('expenses').select('ingredient_name, qty_bought')
    if (expErr) throw expErr

    const { data: recipeLines, error: recErr } = await supabase
      .from('recipe_lines').select('ingredient_id, menu_item_id, qty')
    if (recErr) throw recErr

    const saleItems: Array<{ menu_item_id: string; name: string; qty: number }> = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data: page, error: saleErr } = await supabase
        .from('sale_items')
        .select('menu_item_id, name, qty')
        .range(from, from + PAGE - 1)
      if (saleErr) throw saleErr
      if (!page || page.length === 0) break
      saleItems.push(...page)
      if (page.length < PAGE) break
    }

    const beans = ingredients ?? []
    const ingredientMap = new Map((allIngredients ?? []).map((i: any) => [i.id, i]))

    const recipesByItem: Record<string, Array<{ ingredient_id: string; qty: number }>> = {}
    for (const rl of recipeLines ?? []) {
      if (!recipesByItem[rl.menu_item_id]) recipesByItem[rl.menu_item_id] = []
      recipesByItem[rl.menu_item_id].push({ ingredient_id: rl.ingredient_id, qty: Number(rl.qty) })
    }

    // For each bean: total grams used, total cups, breakdown by drink base name
    const stats: Record<string, { used: number; cups: number; byDrink: Record<string, number> }> = {}
    for (const b of beans) stats[b.id] = { used: 0, cups: 0, byDrink: {} }

    for (const si of saleItems) {
      const recipe = recipesByItem[si.menu_item_id]
      if (!recipe) continue

      const beanMatch = (si.name as string).match(/\(([^)]+)\)/)
      const beanChoice = beanMatch ? beanMatch[1] : null

      let beanIdForThisSale: string | null = null
      let beanGrams = 0

      for (const line of recipe) {
        const recipeIng: any = ingredientMap.get(line.ingredient_id)
        if (!recipeIng || recipeIng.category !== 'Coffee') continue

        let targetId = line.ingredient_id
        if (beanChoice) {
          const chosen = beans.find((i: any) =>
            i.name.toLowerCase().includes(beanChoice.toLowerCase())
          )
          if (chosen) targetId = chosen.id
        }
        beanIdForThisSale = targetId
        beanGrams = line.qty * si.qty
        break
      }

      if (beanIdForThisSale && stats[beanIdForThisSale]) {
        stats[beanIdForThisSale].used += beanGrams
        stats[beanIdForThisSale].cups += si.qty
        const drinkBase = (si.name as string).replace(/\s*\(.*?\)\s*/g, '').replace(/\s*\[.*?\]\s*/g, '').trim()
        stats[beanIdForThisSale].byDrink[drinkBase] =
          (stats[beanIdForThisSale].byDrink[drinkBase] || 0) + si.qty
      }
    }

    const purchasedByName: Record<string, number> = {}
    for (const exp of expenses ?? []) {
      const name = (exp.ingredient_name as string).toLowerCase().trim()
      purchasedByName[name] = (purchasedByName[name] || 0) + Number(exp.qty_bought)
    }

    const result = beans.map((b: any) => {
      const s = stats[b.id]
      const purchased = purchasedByName[b.name.toLowerCase().trim()] || 0
      const remaining = purchased - s.used
      const byDrink = Object.entries(s.byDrink)
        .map(([name, cups]) => ({ name, cups }))
        .sort((a, b) => b.cups - a.cups)
      return {
        id: b.id,
        name: b.name,
        unit: b.unit,
        purchased: Math.round(purchased * 100) / 100,
        used: Math.round(s.used * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        cups_sold: s.cups,
        by_drink: byDrink,
      }
    })

    res.json(result)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
