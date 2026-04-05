import { Router, Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../lib/supabase'

const router = Router()

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// GET /api/ai/context — fetch last 30 days data, format as text summary
router.get('/context', async (_req: Request, res: Response) => {
  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const from = thirtyDaysAgo.toISOString().slice(0, 10)
    const to = now.toISOString().slice(0, 10)
    const currentMonth = to.slice(0, 7)

    // Fetch all data in parallel
    const [salesRes, expensesRes, fixedCostsRes, menuRes] = await Promise.all([
      supabase
        .from('sales')
        .select('*, sale_items(*)')
        .gte('sale_date', from)
        .lte('sale_date', to)
        .order('sale_date', { ascending: false }),
      supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('expense_date', { ascending: false }),
      supabase
        .from('fixed_costs')
        .select('*')
        .eq('month', currentMonth),
      supabase
        .from('menu_items')
        .select('*')
        .eq('is_active', true)
        .order('category'),
    ])

    if (salesRes.error) throw salesRes.error
    if (expensesRes.error) throw expensesRes.error
    if (fixedCostsRes.error) throw fixedCostsRes.error
    if (menuRes.error) throw menuRes.error

    const sales = salesRes.data ?? []
    const expenses = expensesRes.data ?? []
    const fixedCosts = fixedCostsRes.data ?? []
    const menu = menuRes.data ?? []

    // Build sales context
    const totalRevenue = sales.reduce((s, r) => s + Number(r.total_revenue), 0)
    const totalCups = sales.reduce((s, r) => s + r.total_cups, 0)
    const salesByDate: Record<string, { revenue: number; cups: number }> = {}
    for (const sale of sales) {
      const d = sale.sale_date
      if (!salesByDate[d]) salesByDate[d] = { revenue: 0, cups: 0 }
      salesByDate[d].revenue += Number(sale.total_revenue)
      salesByDate[d].cups += sale.total_cups
    }
    const salesContext = `Total: ${totalRevenue.toFixed(2)} AED revenue, ${totalCups} cups over 30 days. Daily avg: ${(totalRevenue / 30).toFixed(2)} AED, ${Math.round(totalCups / 30)} cups.\nDaily breakdown: ${Object.entries(salesByDate)
      .slice(0, 14)
      .map(([d, v]) => `${d}: ${v.revenue.toFixed(2)} AED, ${v.cups} cups`)
      .join('; ')}`

    // Build expenses context
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.total_cost), 0)
    const expensesByCategory: Record<string, number> = {}
    for (const e of expenses) {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.total_cost)
    }
    const expensesContext = `Total: ${totalExpenses.toFixed(2)} AED. By category: ${Object.entries(expensesByCategory)
      .map(([c, v]) => `${c}: ${v.toFixed(2)}`)
      .join(', ')}`

    // Build fixed costs context
    const totalFixed = fixedCosts.reduce((s, f) => s + Number(f.amount), 0)
    const paidFixed = fixedCosts.filter((f) => f.is_paid).reduce((s, f) => s + Number(f.amount), 0)
    const fixedCostsContext = `Month ${currentMonth}: Total ${totalFixed.toFixed(2)} AED. Paid: ${paidFixed.toFixed(2)} AED. Unpaid: ${(totalFixed - paidFixed).toFixed(2)} AED. Items: ${fixedCosts.map((f) => `${f.description} (${f.category}): ${Number(f.amount).toFixed(2)} AED [${f.is_paid ? 'PAID' : 'UNPAID'}]`).join('; ')}`

    // Build menu context
    const menuContext = menu
      .map(
        (m) =>
          `${m.name} (${m.category}): ${Number(m.selling_price).toFixed(2)} AED, COGS ${Number(m.estimated_cogs).toFixed(2)}, margin ${Number(m.gross_margin).toFixed(1)}%`
      )
      .join('; ')

    const netProfit = totalRevenue - totalExpenses - totalFixed

    res.json({
      salesContext,
      expensesContext,
      fixedCostsContext,
      menuContext,
      netProfit,
    })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/ai/chat — receive messages, build system prompt with context, call Anthropic
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, context } = req.body as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      context?: {
        salesContext: string
        expensesContext: string
        fixedCostsContext: string
        menuContext: string
        netProfit: number
      }
    }

    if (!messages || !Array.isArray(messages) || !messages.length) {
      res.status(400).json({ message: 'messages array is required' })
      return
    }

    for (const msg of messages) {
      if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
        res.status(400).json({ message: 'Each message must have role "user" or "assistant"' })
        return
      }
      if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
        res.status(400).json({ message: 'Each message must have non-empty string content' })
        return
      }
      if (msg.content.length > 5000) {
        res.status(400).json({ message: 'Message content must not exceed 5000 characters' })
        return
      }
    }

    const systemPrompt = `You are "Barista AI", an expert coffee shop business analyst for SHEEN café.
You have access to the following real business data:

SALES (last 30 days): ${context?.salesContext ?? 'No data available'}
EXPENSES (last 30 days): ${context?.expensesContext ?? 'No data available'}
FIXED COSTS (this month): ${context?.fixedCostsContext ?? 'No data available'}
MENU & MARGINS: ${context?.menuContext ?? 'No data available'}
NET PROFIT THIS MONTH: ${context?.netProfit !== undefined ? `${context.netProfit.toFixed(2)} AED` : 'No data available'}

Provide concise, specific, actionable advice. Always reference actual numbers.
Keep responses under 200 words unless a detailed analysis is requested.
Tone: warm, professional, direct.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const assistantMessage =
      response.content[0].type === 'text' ? response.content[0].text : ''

    // Save to ai_chats table
    const today = new Date().toISOString().slice(0, 10)
    const lastUserMsg = messages[messages.length - 1]
    await supabase.from('ai_chats').insert([
      { session_date: today, role: 'user', content: lastUserMsg.content },
      { session_date: today, role: 'assistant', content: assistantMessage },
    ])

    res.json({ role: 'assistant', content: assistantMessage })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
