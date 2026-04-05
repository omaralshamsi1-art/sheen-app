import axios from 'axios'
import type { Sale, SaleItem, SalePayload, DashboardKPIs, HourlySales, TopSeller } from '../types'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

export const salesService = {
  async recordSale(payload: SalePayload): Promise<Sale> {
    const { data } = await api.post('/api/sales', payload)
    return data
  },

  async getTodaySales(): Promise<Sale[]> {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await api.get(`/api/sales?from=${today}&to=${today}`)
    return data
  },

  async getSalesByDate(date: string): Promise<Sale[]> {
    const { data } = await api.get(`/api/sales?from=${date}&to=${date}`)
    return data
  },

  async getSaleItems(saleId: string): Promise<SaleItem[]> {
    const { data } = await api.get(`/api/sales/${saleId}/items`)
    return data
  },

  async deleteSale(id: string): Promise<void> {
    await api.delete(`/api/sales/${id}`)
  },

  async getDashboardKPIs(): Promise<DashboardKPIs> {
    const { data } = await api.get('/api/sales/kpis/today')
    return data
  },

  async getHourlySales(date: string): Promise<HourlySales[]> {
    const { data } = await api.get(`/api/sales/hourly?date=${date}`)
    return data
  },

  async getTopSellers(date: string, limit = 5): Promise<TopSeller[]> {
    const { data } = await api.get(`/api/sales/top-sellers?date=${date}&limit=${limit}`)
    return data
  },

  async getLast7DaysRevenue(): Promise<{ date: string; revenue: number; expenses: number }[]> {
    const { data } = await api.get('/api/sales/last-7-days')
    return data
  },
}
