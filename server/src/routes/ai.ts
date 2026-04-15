import { Router, Request, Response } from 'express'
import Groq from 'groq-sdk'
import { supabase } from '../lib/supabase'

const router = Router()

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_INSTRUCTION = `You are "Barista AI", an expert coffee shop business analyst for SHEEN Speciality Coffee.
Business: SHEEN Speciality Coffee, owned by Engineer Ali. Trade License 63802, located at Saqr bin Mohammed City, AlDhait 03, RAK, UAE. Website: sheencafe.ae.
You know EVERYTHING about this café — sales, expenses, menu, recipes, ingredients, stock levels, petty cash, orders, customers, beans, milks.
Provide concise, specific, actionable advice. Always reference actual numbers from the data provided.
Keep responses under 200 words unless a detailed analysis is requested.
Tone: warm, professional, direct.
If asked about something not in the data, say so honestly.`

// ─── Helper: build business context from Supabase ───
async function fetchBusinessContext() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const from = thirtyDaysAgo.toISOString().slice(0, 10)
  const to = now.toISOString().slice(0, 10)
  const currentMonth = to.slice(0, 7)

  const [salesRes, expensesRes, fixedCostsRes, menuRes, pettyRes, ingredientsRes, recipesRes, ordersRes, beanSettingsRes, milkSettingsRes] = await Promise.all([
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
    supabase
      .from('petty_cash_transactions')
      .select('*')
      .gte('date', from)
      .lte('date', to),
    supabase
      .from('ingredients')
      .select('*')
      .order('category'),
    supabase
      .from('recipe_lines')
      .select('menu_item_id, ingredient_id, qty, unit'),
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'bean_options')
      .single(),
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'milk_options')
      .single(),
  ])

  if (salesRes.error) throw salesRes.error
  if (expensesRes.error) throw expensesRes.error
  if (fixedCostsRes.error) throw fixedCostsRes.error
  if (menuRes.error) throw menuRes.error

  const sales = salesRes.data ?? []
  const expenses = expensesRes.data ?? []
  const fixedCosts = fixedCostsRes.data ?? []
  const menu = menuRes.data ?? []
  const pettyTx = pettyRes.data ?? []
  const ingredients = ingredientsRes.data ?? []
  const recipes = recipesRes.data ?? []
  const orders = ordersRes.data ?? []
  const beanOptions = beanSettingsRes.data?.value ?? []
  const milkOptions = milkSettingsRes.data?.value ?? []

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

  // Petty cash
  const pettyDeposits = pettyTx.filter((t: any) => t.type === 'deposit').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const pettyWithdrawals = pettyTx.filter((t: any) => t.type === 'withdrawal').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const pettyCashContext = `Deposits: ${pettyDeposits.toFixed(2)} AED. Withdrawals: ${pettyWithdrawals.toFixed(2)} AED. Net: ${(pettyDeposits - pettyWithdrawals).toFixed(2)} AED.`

  // Ingredients & stock
  const ingredientMap = new Map(ingredients.map((i: any) => [i.id, i]))
  const ingredientsContext = ingredients.map((i: any) =>
    `${i.name} (${i.category}, ${i.unit}): pack ${i.pack_cost} AED, cost/unit ${Number(i.cost_per_unit).toFixed(4)} AED`
  ).join('; ')

  // Recipes
  const recipesByItem: Record<string, string[]> = {}
  for (const r of recipes) {
    const ing = ingredientMap.get(r.ingredient_id)
    if (!ing) continue
    if (!recipesByItem[r.menu_item_id]) recipesByItem[r.menu_item_id] = []
    recipesByItem[r.menu_item_id].push(`${(ing as any).name} ${r.qty}${r.unit}`)
  }
  const recipesContext = Object.entries(recipesByItem)
    .map(([itemId, parts]) => {
      const item = menu.find((m: any) => m.id === itemId)
      return `${item?.name ?? itemId}: ${parts.join(', ')}`
    })
    .join('; ')

  // Orders summary
  const ordersByStatus: Record<string, number> = {}
  for (const o of orders) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1
  }
  const totalOrderRevenue = orders.reduce((s: number, o: any) => s + Number(o.total_amount), 0)
  const ordersContext = `Last 30 days: ${orders.length} orders, ${totalOrderRevenue.toFixed(2)} AED. By status: ${Object.entries(ordersByStatus).map(([k, v]) => `${k}: ${v}`).join(', ')}`

  // Top items from orders
  const itemCounts: Record<string, number> = {}
  for (const o of orders) {
    for (const item of (o.order_items ?? [])) {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.qty
    }
  }
  const topOrderedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, qty]) => `${name}: ${qty}`).join(', ')

  // Bean & milk options
  const beansContext = Array.isArray(beanOptions) ? beanOptions.map((b: any) => `${b.name}${b.premium > 0 ? ` +${b.premium} AED` : ''}`).join(', ') : 'None configured'
  const milksContext = Array.isArray(milkOptions) ? milkOptions.map((m: any) => `${m.name}${m.premium > 0 ? ` +${m.premium} AED` : ''}`).join(', ') : 'None configured'

  return { salesContext, expensesContext, fixedCostsContext, menuContext, netProfit, pettyCashContext, ingredientsContext, recipesContext, ordersContext, topOrderedItems, beansContext, milksContext }
}

// Build the data block that goes into prompts
function buildDataBlock(context: Record<string, any>) {
  const lines = [
    `SALES (last 30 days): ${context.salesContext}`,
    `EXPENSES (last 30 days): ${context.expensesContext}`,
    `PETTY CASH (last 30 days): ${context.pettyCashContext ?? 'N/A'}`,
    `FIXED COSTS (this month): ${context.fixedCostsContext}`,
    `NET PROFIT THIS MONTH: ${context.netProfit?.toFixed?.(2) ?? context.netProfit} AED`,
    `MENU & MARGINS: ${context.menuContext}`,
    `RECIPES: ${context.recipesContext ?? 'N/A'}`,
    `INGREDIENTS: ${context.ingredientsContext ?? 'N/A'}`,
    `BEAN OPTIONS: ${context.beansContext ?? 'N/A'}`,
    `MILK OPTIONS: ${context.milksContext ?? 'N/A'}`,
    `ORDERS (last 30 days): ${context.ordersContext ?? 'N/A'}`,
    `TOP ORDERED ITEMS: ${context.topOrderedItems ?? 'N/A'}`,
  ]
  return lines.join('\n')
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
    const { messages, context, lang } = req.body as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      context?: {
        salesContext: string
        expensesContext: string
        fixedCostsContext: string
        menuContext: string
        netProfit: number
      }
      lang?: string
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

    const langInstruction = lang === 'ar'
      ? '\n\nIMPORTANT: You MUST respond entirely in Arabic (العربية). All your answers, analysis, and advice must be written in Arabic.'
      : ''

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_INSTRUCTION}${langInstruction}\n\nYou have access to the following real business data:\n${dataBlock}`,
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

// ─── POST /api/ai/read-receipt ───
// Accepts a base64 image and returns extracted receipt fields
router.post('/read-receipt', async (req: Request, res: Response) => {
  try {
    const { image } = req.body as { image?: string }
    if (!image || typeof image !== 'string') {
      res.status(400).json({ message: 'image (base64 data URL) is required' })
      return
    }

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract from this receipt/bill image these fields:
- amount: the TOTAL amount paid (number only, in AED or local currency)
- description: a short 2-5 word summary of what was bought (e.g. "Taxi to supplier", "Cleaning supplies", "Printer ink")
- category: MUST be exactly one of: Transport, Cleaning, Supplies, Maintenance, Food, Printing, Other
- date: the date on the receipt in YYYY-MM-DD format, or null if unreadable

Respond ONLY with a valid JSON object. No explanation, no markdown, no code fence.
Example: {"amount": 15.50, "description": "Taxi to supplier", "category": "Transport", "date": "2026-04-14"}
If a field can't be determined, use null for that field.`,
            },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? ''
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) {
      res.status(500).json({ message: 'AI did not return JSON' })
      return
    }

    try {
      const parsed = JSON.parse(match[0])
      res.json(parsed)
    } catch {
      res.status(500).json({ message: 'Failed to parse AI response' })
    }
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
