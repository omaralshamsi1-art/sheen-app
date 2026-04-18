import api from '../lib/api'
import type { Sale, SaleItem, SalePayload, DashboardKPIs, HourlySales, TopSeller } from '../types'

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

  async deleteSale(id: string, reason: string): Promise<void> {
    await api.delete(`/api/sales/${id}`, { data: { reason } })
  },

  async getDashboardKPIs(dateOrRange?: string | { from: string; to: string }): Promise<DashboardKPIs & { petty_cash_spent?: number }> {
    let params: Record<string, string> = {}
    if (typeof dateOrRange === 'string') params.date = dateOrRange
    else if (dateOrRange) { params.from = dateOrRange.from; params.to = dateOrRange.to }
    const { data } = await api.get('/api/sales/kpis/today', { params })
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

  async getRevenueByDays(days: number): Promise<{ date: string; revenue: number; expenses: number }[]> {
    const { data } = await api.get(`/api/sales/last-7-days?days=${days}`)
    return data
  },

  async getSalesBySource(dateOrRange?: string | { from: string; to: string }): Promise<{ source: string; total: number; cups: number; count: number }[]> {
    let params: Record<string, string> = {}
    if (typeof dateOrRange === 'string') params.date = dateOrRange
    else if (dateOrRange) { params.from = dateOrRange.from; params.to = dateOrRange.to }
    const { data } = await api.get('/api/sales/by-source', { params })
    return data
  },
}
