import { supabase } from '../lib/supabase'
import type {
  Sale,
  SaleItem,
  SalePayload,
  Expense,
  ExpensePayload,
  FixedCost,
  FixedCostPayload,
  MenuItem,
  Ingredient,
  PLReport,
} from '../types'

// ─────────────────────────────────────────────
// Sales
// ─────────────────────────────────────────────

export async function getSalesByDateRange(from: string, to: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('*, sale_items(*)')
    .gte('sale_date', from)
    .lte('sale_date', to)
    .order('recorded_at', { ascending: false })

  if (error) throw error
  return data as (Sale & { sale_items: SaleItem[] })[]
}

export async function insertSale(
  sale: { sale_date: string; recorded_by?: string },
  items: Omit<SaleItem, 'id' | 'sale_id'>[]
) {
  const total_cups = items.reduce((sum, i) => sum + i.qty, 0)
  const total_revenue = items.reduce((sum, i) => sum + i.total, 0)

  const { data: saleRow, error: saleErr } = await supabase
    .from('sales')
    .insert({
      sale_date: sale.sale_date,
      recorded_by: sale.recorded_by ?? null,
      total_cups,
      total_revenue,
    })
    .select()
    .single()

  if (saleErr) throw saleErr

  const saleItems = items.map((item) => ({
    sale_id: saleRow.id,
    menu_item_id: item.menu_item_id,
    name: item.name,
    category: item.category,
    price: item.price,
    qty: item.qty,
    total: item.total,
  }))

  const { error: itemsErr } = await supabase
    .from('sale_items')
    .insert(saleItems)

  if (itemsErr) throw itemsErr

  return saleRow as Sale
}

// ─────────────────────────────────────────────
// Expenses
// ─────────────────────────────────────────────

export async function getExpensesByDateRange(from: string, to: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .gte('expense_date', from)
    .lte('expense_date', to)
    .order('recorded_at', { ascending: false })

  if (error) throw error
  return data as Expense[]
}

export async function insertExpense(expense: ExpensePayload) {
  const { data, error } = await supabase
    .from('expenses')
    .insert(expense)
    .select()
    .single()

  if (error) throw error
  return data as Expense
}

// ─────────────────────────────────────────────
// Fixed Costs
// ─────────────────────────────────────────────

export async function getFixedCostsByMonth(month: string) {
  const { data, error } = await supabase
    .from('fixed_costs')
    .select('*')
    .eq('month', month)
    .order('due_date', { ascending: true })

  if (error) throw error
  return data as FixedCost[]
}

export async function insertFixedCost(cost: FixedCostPayload) {
  const { data, error } = await supabase
    .from('fixed_costs')
    .insert(cost)
    .select()
    .single()

  if (error) throw error
  return data as FixedCost
}

export async function updateFixedCostPaid(id: string) {
  const { data, error } = await supabase
    .from('fixed_costs')
    .update({ is_paid: true, paid_date: new Date().toISOString().slice(0, 10) })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as FixedCost
}

// ─────────────────────────────────────────────
// Menu & Ingredients
// ─────────────────────────────────────────────

export async function getMenuItems() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('category')
    .order('name')

  if (error) throw error
  return data as MenuItem[]
}

export async function getIngredients() {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .order('category')
    .order('name')

  if (error) throw error
  return data as Ingredient[]
}

// ─────────────────────────────────────────────
// Reports — P&L
// ─────────────────────────────────────────────

export async function getReportPL(from: string, to: string): Promise<PLReport> {
  const { data: sales, error: salesErr } = await supabase
    .from('sales')
    .select('total_revenue')
    .gte('sale_date', from)
    .lte('sale_date', to)

  if (salesErr) throw salesErr

  const total_revenue = (sales ?? []).reduce(
    (sum, s) => sum + Number(s.total_revenue),
    0
  )

  const { data: expenses, error: expErr } = await supabase
    .from('expenses')
    .select('total_cost')
    .gte('expense_date', from)
    .lte('expense_date', to)

  if (expErr) throw expErr

  const total_cogs = (expenses ?? []).reduce(
    (sum, e) => sum + Number(e.total_cost),
    0
  )

  const fromMonth = from.slice(0, 7)
  const toMonth = to.slice(0, 7)

  const { data: fixedCosts, error: fixErr } = await supabase
    .from('fixed_costs')
    .select('amount')
    .gte('month', fromMonth)
    .lte('month', toMonth)

  if (fixErr) throw fixErr

  const fixed_costs = (fixedCosts ?? []).reduce(
    (sum, f) => sum + Number(f.amount),
    0
  )

  const gross_profit = total_revenue - total_cogs
  const net_profit = gross_profit - fixed_costs
  const net_margin = total_revenue > 0 ? (net_profit / total_revenue) * 100 : 0

  return {
    total_revenue,
    total_cogs,
    gross_profit,
    fixed_costs,
    net_profit,
    net_margin: Math.round(net_margin * 100) / 100,
  }
}
