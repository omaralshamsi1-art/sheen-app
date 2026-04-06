import axios from 'axios'
import type { Order } from '../types'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

export async function getOrders(params?: { status?: string; customer_id?: string }): Promise<Order[]> {
  const { data } = await api.get('/api/orders', { params })
  return data
}

export async function createOrder(payload: {
  customer_id: string
  customer_email?: string
  customer_name?: string
  items: { menu_item_id: string; name: string; price: number; qty: number }[]
  notes?: string
}): Promise<Order> {
  const { data } = await api.post('/api/orders', payload)
  return data
}

export async function updateOrderStatus(id: string, status: string): Promise<Order> {
  const { data } = await api.patch(`/api/orders/${id}`, { status })
  return data
}

export async function deleteOrder(id: string): Promise<void> {
  await api.delete(`/api/orders/${id}`)
}
