import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { insertSale } from '../services/db'
import { isPushConfigured, sendToRoles } from '../lib/push'

const router = Router()

const VALID_STATUSES = ['pending', 'confirmed', 'rejected', 'completed', 'closed']

// GET /api/orders?status=pending — list orders (staff/admin see all, customer sees own)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, customer_id } = req.query

    const today = new Date().toISOString().slice(0, 10)

    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .order('created_at', { ascending: false })

    if (status && typeof status === 'string' && VALID_STATUSES.includes(status)) {
      query = query.eq('status', status)
    }

    if (customer_id && typeof customer_id === 'string') {
      query = query.eq('customer_id', customer_id)
    }

    const { data, error } = await query.limit(200)
    if (error) throw error

    // Enrich each order with the customer's phone from user_roles (best-effort)
    const orders = data ?? []
    if (orders.length > 0) {
      const customerIds = Array.from(new Set(orders.map((o: any) => o.customer_id).filter(Boolean)))
      if (customerIds.length > 0) {
        try {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('user_id, phone, plate_number')
            .in('user_id', customerIds)
          const phoneMap = new Map((roles ?? []).map((r: any) => [r.user_id, { phone: r.phone, plate_number: r.plate_number }]))
          for (const o of orders as any[]) {
            const info = phoneMap.get(o.customer_id)
            o.customer_phone = info?.phone ?? null
            o.customer_plate = info?.plate_number ?? null
          }
        } catch {
          // ignore enrichment failures
        }
      }
    }

    res.json(orders)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/orders — create a new order (customer)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { customer_id, customer_email, customer_name, items, notes, free_item_id } = req.body

    if (!customer_id || typeof customer_id !== 'string') {
      res.status(400).json({ message: 'customer_id is required' })
      return
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'items array is required and must not be empty' })
      return
    }

    for (const item of items) {
      if (!item.menu_item_id || !item.name || typeof item.qty !== 'number' || typeof item.price !== 'number') {
        res.status(400).json({ message: 'Each item requires menu_item_id, name, qty, and price' })
        return
      }
    }

    let total_amount = items.reduce((sum: number, i: any) => sum + (i.price * i.qty), 0)

    // Free-cup redemption: validate eligibility + availability server-side so it
    // can't be faked, then discount one unit of the chosen item.
    let freeCard: any = null
    let freeNote = ''
    if (free_item_id) {
      if (!items.some((i: any) => String(i.menu_item_id) === String(free_item_id))) {
        res.status(400).json({ message: 'Free item must be in the order', code: 'not_in_order' }); return
      }
      const { data: menuItem } = await supabase
        .from('menu_items')
        .select('name, selling_price, free_cup_eligible')
        .eq('id', free_item_id)
        .single()
      if (!menuItem || !menuItem.free_cup_eligible) {
        res.status(400).json({ message: 'This item is not included in the free cup offer', code: 'not_eligible' }); return
      }
      const { data: card } = await supabase
        .from('loyalty_cards')
        .select('*')
        .eq('user_id', customer_id)
        .single()
      const available = card ? card.free_cups_earned - card.free_cups_used : 0
      if (!card || available <= 0) {
        res.status(400).json({ message: 'No free cups available', code: 'no_free_cups' }); return
      }
      freeCard = card
      total_amount = Math.max(0, total_amount - Number(menuItem.selling_price))
      freeNote = `[FreeCup: ${menuItem.name}]`
    }

    const finalNotes = [notes, freeNote].filter(Boolean).join(' ') || null

    // Insert order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id,
        customer_email: customer_email || null,
        customer_name: customer_name || null,
        status: 'pending',
        total_amount,
        notes: finalNotes,
      })
      .select()
      .single()

    if (orderErr) throw orderErr

    // Reserve the free cup now (so it can't be double-spent across orders)
    if (freeCard) {
      try {
        await supabase.from('loyalty_visits').insert({ card_id: freeCard.id, recorded_by: `order:${order.id}`, visit_type: 'redeem' })
        await supabase.from('loyalty_cards').update({ free_cups_used: freeCard.free_cups_used + 1 }).eq('id', freeCard.id)
      } catch { /* don't fail the order if the deduction hiccups */ }
    }

    // Insert order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      menu_item_id: String(item.menu_item_id),
      name: String(item.name).trim(),
      price: Number(item.price),
      qty: Number(item.qty),
      total: Number(item.price) * Number(item.qty),
    }))

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsErr) throw itemsErr

    await logAudit(req, { action: 'create', entity: 'order', entity_id: order.id, details: { page: 'Customer Order', customer: order.customer_name || order.customer_email, items: orderItems.map((i: any) => `${i.name} x${i.qty}`).join(', '), total_amount: order.total_amount } })

    // Alert staff/admin devices of the new order (best-effort — never blocks or
    // fails the order if push isn't configured or FCM errors).
    if (isPushConfigured()) {
      const who = order.customer_name || order.customer_email || 'A customer'
      const summary = orderItems.map((i: any) => `${i.name} ×${i.qty}`).join(', ')
      sendToRoles(
        ['admin', 'staff'],
        'New order received',
        `${who}: ${summary} — ${Number(order.total_amount).toFixed(2)} AED`,
        { type: 'new_order', orderId: String(order.id) },
      ).catch((e) => console.error('new-order push failed:', e?.message || e))
    }

    res.status(201).json(order)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/orders/:id — update order status (staff/admin)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { status } = req.body

    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ message: `status must be one of: ${VALID_STATUSES.join(', ')}` })
      return
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*, order_items(*)')
      .single()

    if (error) throw error

    // Auto-add loyalty visit only when order is completed (customer got their coffee).
    // A free-cup redemption order does NOT earn a visit toward the next reward.
    const redeemedFreeCup = /FreeCup/i.test(data.notes || '')
    if (status === 'completed' && data.customer_id && !redeemedFreeCup) {
      try {
        // Find or create loyalty card
        const { data: card } = await supabase
          .from('loyalty_cards')
          .select('*')
          .eq('user_id', data.customer_id)
          .single()

        if (card) {
          // Check if this order already had a visit recorded (avoid duplicates)
          const { data: existingVisit } = await supabase
            .from('loyalty_visits')
            .select('id')
            .eq('card_id', card.id)
            .eq('recorded_by', `order:${req.params.id}`)
            .single()

          if (!existingVisit) {
            // Add visit
            await supabase.from('loyalty_visits').insert({
              card_id: card.id,
              recorded_by: `order:${req.params.id}`,
              visit_type: 'visit',
            })

            const newVisits = card.total_visits + 1
            const newFreeCups = Math.floor(newVisits / 6)

            await supabase
              .from('loyalty_cards')
              .update({ total_visits: newVisits, free_cups_earned: newFreeCups })
              .eq('id', card.id)
          }
        }
      } catch {
        // Loyalty update failed — don't block the order update
      }
    }

    // Record a completed order as a sale so online (card/Apple Pay) revenue
    // shows in the Dashboard, Reports and AI. De-duped via recorded_by.
    if (status === 'completed') {
      try {
        const orderId = String(req.params.id)
        const { data: existingSale } = await supabase
          .from('sales')
          .select('id')
          .eq('order_id', orderId)
          .maybeSingle()

        if (!existingSale) {
          const { data: oItems } = await supabase
            .from('order_items')
            .select('menu_item_id, name, price, qty, total')
            .eq('order_id', orderId)

          if (oItems && oItems.length) {
            await insertSale(
              {
                sale_date: new Date().toISOString().slice(0, 10),
                // All customer-app orders (card / Apple Pay / app cash) group
                // under the "App" source. The de-dup key lives in order_id.
                recorded_by: 'App',
                order_id: orderId,
                notes: data.notes && /cash/i.test(data.notes) ? 'Cash order (app)' : 'Online order (card / Apple Pay)',
              },
              oItems.map((i: any) => ({
                menu_item_id: i.menu_item_id,
                name: i.name,
                category: '',
                price: Number(i.price),
                qty: Number(i.qty),
                total: Number(i.total),
              })),
            )
          }
        }
      } catch {
        // Don't block the order update if sale recording fails
      }
    }

    await logAudit(req, { action: 'update', entity: 'order', entity_id: req.params.id, details: { page: 'Orders', customer: data.customer_name || data.customer_email, status_changed: `→ ${status}`, total_amount: data.total_amount } })
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/orders/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { data: existing } = await supabase.from('orders').select('status, total_amount, customer_email').eq('id', req.params.id).single()
    const { error } = await supabase.from('orders').delete().eq('id', req.params.id)
    if (error) throw error
    await logAudit(req, { action: 'delete', entity: 'order', entity_id: req.params.id, details: { page: 'Orders', customer: existing?.customer_email, status: existing?.status, total_amount: existing?.total_amount } })
    res.json({ message: 'Order deleted' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
