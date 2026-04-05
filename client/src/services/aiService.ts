import axios from 'axios'
import type { AiContextResponse } from '../types'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

export const aiService = {
  async getContext(): Promise<AiContextResponse> {
    const { data } = await api.get('/api/ai/context')
    return data
  },

  async chat(messages: { role: 'user' | 'assistant'; content: string }[], context?: AiContextResponse): Promise<string> {
    const { data } = await api.post('/api/ai/chat', { messages, context })
    return data.content
  },

  async getChatHistory(date?: string): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const params = date ? { date } : {}
    const { data } = await api.get('/api/ai/history', { params })
    return data
  },
}
