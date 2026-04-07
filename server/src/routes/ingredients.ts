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
