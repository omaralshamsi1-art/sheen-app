import { Router, Request, Response } from 'express'
import Groq from 'groq-sdk'
import { supabase } from '../lib/supabase'

const router = Router()

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_INSTRUCTION = `You are "Barista AI", an expert coffee shop business analyst for SHEEN café.
Provide concise, specific, actionable advice. Always reference actual numbers.
Keep responses under 200 words unless a detailed analysis is requested.
Tone: warm, professional, direct.`

// ─── Helper: build business context from Supabase ───
async function fetchBusinessContext() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const from = thirtyDaysAgo.toISOString().slice(0, 10)
  const to = now.toISOString().slice(0, 10)
  const currentMonth = to.slice(0, 7)

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

  const totalRevenue = sales.reduce((s, r) => s + Number(r.total_revenue), 0)
  const totalCups = sales.reduce((s, r) => s + r.total_cups, 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.total_cost), 0)
  const totalFixed = fixedCosts.reduce((s, f) => s + Number(f.amount), 0)
  const paidFixed = fixedCosts.filter((f) => f.is_paid).reduce((s, f) => s + Number(f.amount), 0)
  const netProfit = totalRevenue - totalExpenses - totalFixed

  const salesByDate: Record<string, { revenue: number; cups: number }> = {}
  for (const sale of sales) {
    const d = sale.sale_date
    if (!salesByDate[d]) salesByDate[d] = { revenue: 0, cups: 0 }
    salesByDate[d].revenue += Number(sale.total_revenue)
    salesByDate[d].cups += sale.total_cups
  }

  const expensesByCategory: Record<string, number> = {}
  for (const e of expenses) {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.total_cost)
  }

  const salesContext = `Total: ${totalRevenue.toFixed(2)} AED revenue, ${totalCups} cups over 30 days. Daily avg: ${(totalRevenue / 30).toFixed(2)} AED, ${Math.round(totalCups / 30)} cups.\nDaily breakdown: ${Object.entries(salesByDate)
    .slice(0, 14)
    .map(([d, v]) => `${d}: ${v.revenue.toFixed(2)} AED, ${v.cups} cups`)
    .join('; ')}`

  const expensesContext = `Total: ${totalExpenses.toFixed(2)} AED. By category: ${Object.entries(expensesByCategory)
    .map(([c, v]) => `${c}: ${v.toFixed(2)}`)
    .join(', ')}`

  const fixedCostsContext = `Month ${currentMonth}: Total ${totalFixed.toFixed(2)} AED. Paid: ${paidFixed.toFixed(2)} AED. Unpaid: ${(totalFixed - paidFixed).toFixed(2)} AED. Items: ${fixedCosts.map((f) => `${f.description} (${f.category}): ${Number(f.amount).toFixed(2)} AED [${f.is_paid ? 'PAID' : 'UNPAID'}]`).join('; ')}`

  const menuContext = menu
    .map(
      (m) =>
        `${m.name} (${m.category}): ${Number(m.selling_price).toFixed(2)} AED, COGS ${Number(m.estimated_cogs).toFixed(2)}, margin ${Number(m.gross_margin).toFixed(1)}%`
    )
    .join('; ')

  return { salesContext, expensesContext, fixedCostsContext, menuContext, netProfit }
}

// Build the data block that goes into prompts
function buildDataBlock(context: {
  salesContext: string
  expensesContext: string
  fixedCostsContext: string
  menuContext: string
  netProfit: number
}) {
  return `SALES (last 30 days): ${context.salesContext}
EXPENSES (last 30 days): ${context.expensesContext}
FIXED COSTS (this month): ${context.fixedCostsContext}
MENU & MARGINS: ${context.menuContext}
NET PROFIT THIS MONTH: ${context.netProfit.toFixed(2)} AED`
}

// ─── GET /api/ai/context ───
router.get('/context', async (_req: Request, res: Response) => {
  try {
    const ctx = await fetchBusinessContext()
    res.json(ctx)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── POST /api/ai/chat ───
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

    const dataBlock = context
      ? buildDataBlock(context)
      : 'No business data provided.'

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_INSTRUCTION}\n\nYou have access to the following real business data:\n${dataBlock}`,
        },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
    })

    const assistantMessage = response.choices[0]?.message?.content ?? ''

    // Save to ai_chats table
    const today = new Date().toISOString().slice(0, 10)
    const lastMsg = messages[messages.length - 1]
    await supabase.from('ai_chats').insert([
      { session_date: today, role: 'user', content: lastMsg.content },
      { session_date: today, role: 'assistant', content: assistantMessage },
    ])

    res.json({ role: 'assistant', content: assistantMessage })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── POST /api/ai/analyze ───
router.post('/analyze', async (_req: Request, res: Response) => {
  try {
    const ctx = await fetchBusinessContext()
    const dataBlock = buildDataBlock(ctx)

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_INSTRUCTION}\n\nYou have access to the following real business data:\n${dataBlock}`,
        },
        {
          role: 'user',
          content: "Analyze this coffee shop's performance and give me 3 specific, actionable bullet-point insights I should act on right now.",
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? ''

    // Save to ai_chats
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('ai_chats').insert([
      { session_date: today, role: 'user', content: 'Auto-analysis request' },
      { session_date: today, role: 'assistant', content },
    ])

    res.json({ role: 'assistant', content })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET /api/ai/history ───
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { date } = req.query
    let query = supabase
      .from('ai_chats')
      .select('*')
      .order('created_at', { ascending: true })

    if (date && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      query = query.eq('session_date', date)
    }

    const { data, error } = await query.limit(200)

    if (error) throw error
    res.json(data ?? [])
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// ─── DELETE /api/ai/history ───
router.delete('/history', async (_req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from('ai_chats')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (error) throw error
    res.json({ message: 'Chat history cleared' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
