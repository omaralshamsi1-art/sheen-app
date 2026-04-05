import { Router, Request, Response } from 'express'
import { getReportPL, getSalesByDateRange } from '../services/db'
import { supabase } from '../lib/supabase'

const router = Router()

// GET /api/reports/pl?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/pl', async (req: Request, res: Response) => {
  try {
    const now = new Date()
    const from =
      (req.query.from as string) ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const to = (req.query.to as string) || now.toISOString().slice(0, 10)
    const report = await getReportPL(from, to)
    res.json(report)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/reports/top-sellers?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=10
router.get('/top-sellers', async (req: Request, res: Response) => {
  try {
    const now = new Date()
    const from =
      (req.query.from as string) ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const to = (req.query.to as string) || now.toISOString().slice(0, 10)
    const limit = parseInt(req.query.limit as string) || 10

    const { data, error } = await supabase
      .from('sale_items')
      .select('name, category, qty, total, sale_id, sales!inner(sale_date)')
      .gte('sales.sale_date', from)
      .lte('sales.sale_date', to)

    if (error) throw error

    const grouped: Record<string, { name: string; category: string; qty: number; revenue: number }> = {}
    for (const row of data ?? []) {
      if (!grouped[row.name]) {
        grouped[row.name] = { name: row.name, category: row.category, qty: 0, revenue: 0 }
      }
      grouped[row.name].qty += row.qty
      grouped[row.name].revenue += Number(row.total)
    }

    const topSellers = Object.values(grouped)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)

    res.json(topSellers)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/reports/daily?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/daily', async (req: Request, res: Response) => {
  try {
    const now = new Date()
    const from =
      (req.query.from as string) ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const to = (req.query.to as string) || now.toISOString().slice(0, 10)

    const sales = await getSalesByDateRange(from, to)

    const grouped: Record<string, { date: string; revenue: number; cups: number }> = {}
    for (const sale of sales) {
      const d = sale.sale_date
      if (!grouped[d]) {
        grouped[d] = { date: d, revenue: 0, cups: 0 }
      }
      grouped[d].revenue += Number(sale.total_revenue)
      grouped[d].cups += sale.total_cups
    }

    const daily = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))
    res.json(daily)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
