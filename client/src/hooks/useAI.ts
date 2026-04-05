import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aiService } from '../services/aiService'
import toast from 'react-hot-toast'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function useAIContext() {
  return useQuery({
    queryKey: ['ai', 'context'],
    queryFn: aiService.getContext,
    staleTime: 60_000,
  })
}

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = { role: 'user', content }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      // Fetch fresh context before every AI call
      const context = await aiService.getContext()
      const allMessages = [...messages, userMsg]
      const response = await aiService.chat(allMessages, context)
      const assistantMsg: ChatMessage = { role: 'assistant', content: response }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      toast.error('AI request failed')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }, [messages])

  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, isLoading, sendMessage, clearMessages, setMessages }
}

export function useAutoInsight() {
  const [insight, setInsight] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const fetchInsight = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch fresh context before insight generation
      const context = await aiService.getContext()
      const response = await aiService.chat([{
        role: 'user',
        content: 'Analyze this coffee shop\'s performance and give me 3 specific, actionable bullet-point insights I should act on right now.',
      }], context)
      setInsight(response)
    } catch {
      toast.error('Failed to load AI insight')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { insight, isLoading, fetchInsight }
}
