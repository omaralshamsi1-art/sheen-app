import axios from 'axios'
import type { Expense, ExpensePayload, Ingredient } from '../types'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

export const expenseService = {
  async getExpenses(params?: { start?: string; end?: string; category?: string }): Promise<Expense[]> {
    const { data } = await api.get('/api/expenses', {
      params: params ? { from: params.start, to: params.end, category: params.category } : undefined,
    })
    return data
  },

  async createExpense(payload: ExpensePayload): Promise<Expense> {
    const { data } = await api.post('/api/expenses', payload)
    return data
  },

  async deleteExpense(id: string): Promise<void> {
    await api.delete(`/api/expenses/${id}`)
  },

  async getIngredients(): Promise<Ingredient[]> {
    const { data } = await api.get('/api/ingredients')
    return data
  },

  async getExpenseSummary(params?: { start?: string; end?: string }): Promise<{ category: string; total: number }[]> {
    const { data } = await api.get('/api/expenses/summary', {
      params: params ? { from: params.start, to: params.end } : undefined,
    })
    return data
  },
}
