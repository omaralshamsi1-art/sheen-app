import { Router, Request, Response } from 'express'
import { getSalesByDateRange, insertSale } from '../services/db'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

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

// GET /api/sales/kpis/today — dashboard KPIs
// Query params:
//   ?date=YYYY-MM-DD (single day, default today)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD (date range, overrides date)
router.get('/kpis/today', async (req: Request, res: Response) => {
  try {
    const fromParam = req.query.from as string | undefined
    const toParam = req.query.to as string | undefined
    const isRange = !!(fromParam && toParam)

    const single = (req.query.date as string) || new Date().toISOString().slice(0, 10)
    const from = isRange ? fromParam! : single
    const to = isRange ? toParam! : single

    // Revenue + cups from sales
    const salesQ = supabase.from('sales').select('total_revenue, total_cups')
    const { data: sales, error: salesErr } = await (
      isRange ? salesQ.gte('sale_date', from).lte('sale_date', to) : salesQ.eq('sale_date', single)
    )

    if (salesErr) throw salesErr

    const total_revenue = (sales ?? []).reduce((s, r) => s + Number(r.total_revenue), 0)
    const total_cups = (sales ?? []).reduce((s, r) => s + r.total_cups, 0)

    // Expenses
    const expQ = supabase.from('expenses').select('total_cost')
    const { data: expenses, error: expErr } = await (
      isRange ? expQ.gte('expense_date', from).lte('expense_date', to) : expQ.eq('expense_date', single)
    )
    if (expErr) throw expErr

    const total_expenses = (expenses ?? []).reduce((s, e) => s + Number(e.total_cost), 0)

    // Petty cash withdrawals
    const pettyQ = supabase.from('petty_cash_transactions').select('amount, type').eq('type', 'withdrawal')
    const { data: petty, error: pettyErr } = await (
      isRange ? pettyQ.gte('date', from).lte('date', to) : pettyQ.eq('date', single)
    )
    if (pettyErr) throw pettyErr

    const petty_cash_spent = (petty ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const combined_expenses = total_expenses + petty_cash_spent
    const net_profit = total_revenue - combined_expenses

    res.json({ total_revenue, total_cups, total_expenses, petty_cash_spent, net_profit })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/sales/hourly?date=YYYY-MM-DD — cups by hour
router.get('/hourly', async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10)

    const { data: sales, error } = await supabase
      .from('sales')
      .select('recorded_at, total_cups')
      .eq('sale_date', date)

    if (error) throw error

    // Aggregate by hour (6am to 11pm) — UAE is UTC+4
    const hourMap: Record<number, number> = {}
    for (let h = 6; h <= 23; h++) hourMap[h] = 0

    for (const sale of sales ?? []) {
      const utcHour = new Date(sale.recorded_at).getUTCHours()
      const uaeHour = (utcHour + 4) % 24
      if (uaeHour >= 6 && uaeHour <= 23) {
        hourMap[uaeHour] += Number(sale.total_cups) || 0
      }
    }

    const result = Object.entries(hourMap).map(([hour, cups]) => ({
      hour: Number(hour),
      cups,
    }))

    res.json(result)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/sales/top-sellers?date=YYYY-MM-DD&limit=5
router.get('/top-sellers', async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10)
    const limit = Number(req.query.limit) || 5

    // Get sale IDs for the date
    const { data: sales, error: salesErr } = await supabase
      .from('sales')
      .select('id')
      .eq('sale_date', date)

    if (salesErr) throw salesErr

    const saleIds = (sales ?? []).map((s) => s.id)

    if (saleIds.length === 0) {
      res.json([])
      return
    }

    const { data: items, error: itemsErr } = await supabase
      .from('sale_items')
      .select('name, category, qty, total')
      .in('sale_id', saleIds)

    if (itemsErr) throw itemsErr

    // Aggregate by item name
    const map: Record<string, { name: string; category: string; qty: number; revenue: number }> = {}
    for (const item of items ?? []) {
      if (!map[item.name]) {
        map[item.name] = { name: item.name, category: item.category, qty: 0, revenue: 0 }
      }
      map[item.name].qty += item.qty
      map[item.name].revenue += Number(item.total)
    }

    const sorted = Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)

    res.json(sorted)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/sales/by-source — today's revenue grouped by recorded_by source
// Optional query param: ?date=YYYY-MM-DD (default today)
router.get('/by-source', async (req: Request, res: Response) => {
  try {
    const fromParam = req.query.from as string | undefined
    const toParam = req.query.to as string | undefined
    const isRange = !!(fromParam && toParam)
    const single = (req.query.date as string) || new Date().toISOString().slice(0, 10)

    const q = supabase.from('sales').select('recorded_by, total_revenue, total_cups')
    const { data: sales, error } = await (
      isRange ? q.gte('sale_date', fromParam!).lte('sale_date', toParam!) : q.eq('sale_date', single)
    )

    if (error) throw error

    const bySource: Record<string, { total: number; cups: number; count: number }> = {}
    for (const s of sales ?? []) {
      const src = (s.recorded_by as string) || 'POS'
      if (!bySource[src]) bySource[src] = { total: 0, cups: 0, count: 0 }
      bySource[src].total += Number(s.total_revenue)
      bySource[src].cups += Number(s.total_cups)
      bySource[src].count += 1
    }

    const result = Object.entries(bySource)
      .map(([source, d]) => ({ source, total: d.total, cups: d.cups, count: d.count }))
      .sort((a, b) => b.total - a.total)

    res.json(result)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/sales/last-7-days — revenue + expenses per day
// Optional query param: ?days=30 (default 7)
router.get('/last-7-days', async (req: Request, res: Response) => {
  try {
    const numDays = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 90)
    const today = new Date()
    const days: { date: string; revenue: number; expenses: number; petty_cash: number }[] = []

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      days.push({ date: dateStr, revenue: 0, expenses: 0, petty_cash: 0 })
    }

    const from = days[0].date
    const to = days[days.length - 1].date

    const [salesRes, expRes, pettyRes] = await Promise.all([
      supabase
        .from('sales')
        .select('sale_date, total_revenue')
        .gte('sale_date', from)
        .lte('sale_date', to),
      supabase
        .from('expenses')
        .select('expense_date, total_cost')
        .gte('expense_date', from)
        .lte('expense_date', to),
      supabase
        .from('petty_cash_transactions')
        .select('date, amount, type')
        .eq('type', 'withdrawal')
        .gte('date', from)
        .lte('date', to),
    ])

    if (salesRes.error) throw salesRes.error
    if (expRes.error) throw expRes.error
    if (pettyRes.error) throw pettyRes.error

    for (const sale of salesRes.data ?? []) {
      const day = days.find((d) => d.date === sale.sale_date)
      if (day) day.revenue += Number(sale.total_revenue)
    }

    for (const exp of expRes.data ?? []) {
      const day = days.find((d) => d.date === exp.expense_date)
      if (day) day.expenses += Number(exp.total_cost)
    }

    for (const p of pettyRes.data ?? []) {
      const day = days.find((d) => d.date === p.date)
      if (day) day.petty_cash += Number(p.amount)
    }

    res.json(days)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/sales
router.post('/', async (req: Request, res: Response) => {
  try {
    const { sale_date, items, recorded_by, notes } = req.body
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
      {
        sale_date,
        recorded_by: recorded_by ? String(recorded_by).trim().slice(0, 100) : undefined,
        notes: notes ? String(notes).trim().slice(0, 200) : undefined,
      },
      sanitizedItems
    )

    // Also create a completed order so it shows on the Orders page
    const totalAmount = sanitizedItems.reduce((s: number, i: any) => s + i.total, 0)
    const staffEmail = req.headers['x-user-email'] as string | undefined
    const source = recorded_by ? String(recorded_by).trim() : 'POS'

    const { data: order } = await supabase
      .from('orders')
      .insert({
        customer_id: req.headers['x-user-id'] ?? null,
        customer_email: staffEmail ?? null,
        customer_name: `${source}: ${staffEmail?.split('@')[0] ?? 'Staff'}`,
        status: 'completed',
        total_amount: totalAmount,
        notes: notes ? `[${source} — ${sale_date}] ${String(notes).trim()}` : `[${source} — ${sale_date}]`,
      })
      .select()
      .single()

    if (order) {
      const orderItems = sanitizedItems.map((item: any) => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        total: item.total,
      }))
      await supabase.from('order_items').insert(orderItems)
    }

    await logAudit(req, { action: 'create', entity: 'sale', entity_id: sale.id, details: { page: 'Sales', sale_date, items: sanitizedItems.map((i: any) => `${i.name} x${i.qty}`).join(', '), total_revenue: totalAmount } })
    res.status(201).json(sale)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/sales/:id — requires a reason in the body
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : ''
    if (!reason) {
      res.status(400).json({ message: 'Reason is required to delete a sale' })
      return
    }

    const { data: existing } = await supabase
      .from('sales')
      .select('sale_date, total_revenue, total_cups, recorded_by, sale_items(name, qty)')
      .eq('id', req.params.id)
      .single()

    const { error } = await supabase.from('sales').delete().eq('id', req.params.id)
    if (error) throw error

    const itemsSummary = (existing?.sale_items as any[] | undefined)?.map((si: any) => `${si.name} ×${si.qty}`).join(', ') ?? ''

    await logAudit(req, {
      action: 'delete',
      entity: 'sale',
      entity_id: req.params.id,
      details: {
        page: 'Sales',
        sale_date: existing?.sale_date,
        total_revenue: existing?.total_revenue,
        cups: existing?.total_cups,
        source: existing?.recorded_by,
        items: itemsSummary,
        reason,
      },
    })

    res.json({ message: 'Sale deleted' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
