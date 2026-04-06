import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

const VALID_STATUSES = ['pending', 'confirmed', 'rejected', 'completed']

// GET /api/orders?status=pending — list orders (staff/admin see all, customer sees own)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, customer_id } = req.query

    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })

    if (status && typeof status === 'string' && VALID_STATUSES.includes(status)) {
      query = query.eq('status', status)
    }

    if (customer_id && typeof customer_id === 'string') {
      query = query.eq('customer_id', customer_id)
    }

    const { data, error } = await query.limit(100)
    if (error) throw error
    res.json(data ?? [])
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/orders — create a new order (customer)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { customer_id, customer_email, customer_name, items, notes } = req.body

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

    const total_amount = items.reduce((sum: number, i: any) => sum + (i.price * i.qty), 0)

    // Insert order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id,
        customer_email: customer_email || null,
        customer_name: customer_name || null,
        status: 'pending',
        total_amount,
        notes: notes || null,
      })
      .select()
      .single()

    if (orderErr) throw orderErr

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
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/orders/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ message: 'Order deleted' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
