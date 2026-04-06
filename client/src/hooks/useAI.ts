import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aiService } from '../services/aiService'
import { useLanguage } from '../i18n/LanguageContext'
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
  const { lang } = useLanguage()

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = { role: 'user', content }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const context = await aiService.getContext()
      const allMessages = [...messages, userMsg]
      const response = await aiService.chat(allMessages, context, lang)
      const assistantMsg: ChatMessage = { role: 'assistant', content: response }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      toast.error('AI request failed')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }, [messages, lang])

  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, isLoading, sendMessage, clearMessages, setMessages }
}

export function useAutoInsight() {
  const [insight, setInsight] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const { lang } = useLanguage()

  const fetchInsight = useCallback(async () => {
    setIsLoading(true)
    try {
      const context = await aiService.getContext()
      const prompt = lang === 'ar'
        ? 'حلل أداء هذا المقهى وأعطني 3 نصائح محددة وقابلة للتنفيذ يجب أن أعمل عليها الآن. أجب بالعربية.'
        : "Analyze this coffee shop's performance and give me 3 specific, actionable bullet-point insights I should act on right now."
      const response = await aiService.chat([{
        role: 'user',
        content: prompt,
      }], context, lang)
      setInsight(response)
    } catch {
      toast.error('Failed to load AI insight')
    } finally {
      setIsLoading(false)
    }
  }, [lang])

  return { insight, isLoading, fetchInsight }
}
