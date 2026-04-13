import { supabase } from '../lib/supabase'

/**
 * Add stock when an expense is recorded.
 * Matches the expense ingredient_name to an ingredient record (case-insensitive).
 */
export async function addStock(ingredientName: string, qty: number) {
  // Find matching ingredient by name (case-insensitive)
  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name, stock_qty')

  if (!ingredients) return

  const match = ingredients.find(
    (ing: any) => ing.name.toLowerCase() === ingredientName.toLowerCase()
  )
  if (!match) return

  const newQty = Number(match.stock_qty) + qty
  await supabase
    .from('ingredients')
    .update({ stock_qty: newQty })
    .eq('id', match.id)
}

/**
 * Deduct stock when a sale is recorded.
 * For each sale item:
 *   1. Look up the recipe for the menu item
 *   2. For each recipe line, deduct (recipe_qty × sale_qty) from ingredient stock
 *   3. If the item is a coffee with a bean choice, substitute the bean ingredient
 *
 * Bean substitution logic:
 *   - Extract bean name from parentheses in sale item name: "Americano (Colombia Tobacco)"
 *   - Find recipe lines where the ingredient category is 'Coffee'
 *   - Instead of deducting from the default recipe bean, deduct from the bean
 *     whose name contains the chosen bean name
 */
export async function deductStock(
  items: Array<{ menu_item_id: string; name: string; qty: number }>
) {
  // Load all ingredients and recipe lines in bulk
  const [{ data: ingredients }, { data: recipeLines }] = await Promise.all([
    supabase.from('ingredients').select('id, name, category, stock_qty'),
    supabase.from('recipe_lines').select('menu_item_id, ingredient_id, qty'),
  ])

  if (!ingredients || !recipeLines) return

  const ingredientMap = new Map(
    ingredients.map((i: any) => [i.id, { ...i, stock_qty: Number(i.stock_qty) }])
  )

  // Track all deductions: ingredient_id → total qty to deduct
  const deductions = new Map<string, number>()

  for (const item of items) {
    // Find recipe lines for this menu item
    const recipe = recipeLines.filter((r: any) => r.menu_item_id === item.menu_item_id)
    if (recipe.length === 0) continue

    // Extract bean choice from name like "Americano (Ethiopia)"
    const beanMatch = item.name.match(/\(([^)]+)\)$/)
    const beanChoice = beanMatch ? beanMatch[1] : null

    for (const line of recipe) {
      const deductQty = Number(line.qty) * item.qty
      let targetIngredientId = line.ingredient_id

      // Bean substitution: if this recipe line uses a Coffee-category ingredient
      // and the customer chose a different bean, swap it
      if (beanChoice) {
        const recipeIngredient = ingredientMap.get(line.ingredient_id)
        if (recipeIngredient && recipeIngredient.category === 'Coffee') {
          // Find the ingredient matching the bean choice
          const chosenBean = ingredients.find(
            (i: any) =>
              i.category === 'Coffee' &&
              i.name.toLowerCase().includes(beanChoice.toLowerCase())
          )
          if (chosenBean) {
            targetIngredientId = chosenBean.id
          }
        }
      }

      const current = deductions.get(targetIngredientId) ?? 0
      deductions.set(targetIngredientId, current + deductQty)
    }
  }

  // Apply all deductions in parallel
  const updates = Array.from(deductions.entries()).map(([ingredientId, qty]) => {
    const ing = ingredientMap.get(ingredientId)
    if (!ing) return null
    const newQty = Math.max(0, ing.stock_qty - qty)
    return supabase
      .from('ingredients')
      .update({ stock_qty: newQty })
      .eq('id', ingredientId)
  })

  await Promise.all(updates.filter(Boolean))
}
