import axios from 'axios'
import type { PLReport, CategoryBreakdown, TopSeller, DailyRevenue } from '../types'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

export const reportsService = {
  async getPL(start: string, end: string): Promise<PLReport> {
    const { data } = await api.get('/api/reports/pl', { params: { from: start, to: end } })
    return data
  },

  async getRevenueByCategory(start: string, end: string): Promise<CategoryBreakdown[]> {
    const { data } = await api.get('/api/reports/revenue-by-category', { params: { from: start, to: end } })
    return data
  },

  async getTopSellers(start: string, end: string, limit = 10): Promise<TopSeller[]> {
    const { data } = await api.get('/api/reports/top-sellers', { params: { from: start, to: end, limit } })
    return data
  },

  async getDailyRevenue(start: string, end: string): Promise<DailyRevenue[]> {
    const { data } = await api.get('/api/reports/daily', { params: { from: start, to: end } })
    return data
  },

  async getExpensesByCategory(start: string, end: string): Promise<CategoryBreakdown[]> {
    const { data } = await api.get('/api/reports/expenses-by-category', { params: { from: start, to: end } })
    return data
  },
}
