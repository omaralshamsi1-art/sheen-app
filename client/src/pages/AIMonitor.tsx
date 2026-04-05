import { useState, useRef, useEffect } from 'react'
import { useAIChat, useAutoInsight } from '../hooks/useAI'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'

const QUICK_QUESTIONS_EN = [
  "Today's Performance Summary",
  'Best Selling Items This Week',
  'Revenue Trend — Am I Growing?',
  'Which Items Have the Best Margin?',
  'Pricing Recommendations',
  'Slow Hours — How to Boost Sales?',
  'Monthly Profit Forecast',
  'What Should I Restock?',
]

export default function AIMonitor() {
  const { t } = useLanguage()
  const quickQuestions = [t('qq1'), t('qq2'), t('qq3'), t('qq4'), t('qq5'), t('qq6'), t('qq7'), t('qq8')]
  const { insight, isLoading: insightLoading, fetchInsight: refreshInsight } = useAutoInsight()
  const { messages, sendMessage, isLoading: isTyping } = useAIChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
    }
  }, [input])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isTyping) return
    sendMessage(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickQuestion = (idx: number) => {
    if (isTyping) return
    sendMessage(QUICK_QUESTIONS_EN[idx])
  }

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('aiBusinessAnalyst')} />

      <div className="mx-auto max-w-4xl space-y-6 p-4 pb-8">
        {/* ── Auto-Analysis Panel ── */}
        <section className="rounded-xl border-2 border-sheen-gold bg-sheen-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-sheen-black">
              {t('autoAnalysis')}
            </h2>
            <Button
              onClick={refreshInsight}
              disabled={insightLoading}
              className="text-sm"
            >
              {insightLoading ? t('analysing') : t('refresh')}
            </Button>
          </div>

          {insightLoading && !insight ? (
            <div className="flex items-center gap-2 text-sheen-muted">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sheen-gold border-t-transparent" />
              <span className="font-body text-sm">
                {t('generatingInsights')}
              </span>
            </div>
          ) : insight ? (
            <div className="font-body text-sm leading-relaxed text-sheen-black whitespace-pre-line">
              {insight}
            </div>
          ) : (
            <p className="font-body text-sm text-sheen-muted">
              {t('noInsightsYet')}
            </p>
          )}
        </section>

        {/* ── Quick Questions ── */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-sheen-black">
            {t('quickQuestions')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isTyping}
                onClick={() => handleQuickQuestion(idx)}
                className="rounded-xl bg-sheen-white px-3 py-3 text-left font-body text-sm font-medium text-sheen-black shadow-sm transition hover:shadow-md hover:ring-1 hover:ring-sheen-gold disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </section>

        {/* ── Chat Interface ── */}
        <section className="flex flex-col overflow-hidden rounded-xl bg-sheen-white shadow-sm">
          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: 420 }}>
            {messages.length === 0 && (
              <p className="py-8 text-center font-body text-sm text-sheen-muted">
                {t('askAnything')}
              </p>
            )}

            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              return (
                <div
                  key={idx}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 font-body text-sm leading-relaxed ${
                      isUser
                        ? 'bg-sheen-brown text-sheen-white'
                        : 'bg-sheen-white text-sheen-black ring-1 ring-sheen-cream'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              )
            })}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl bg-sheen-white px-4 py-3 ring-1 ring-sheen-cream">
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-sheen-gold [animation-delay:0ms]" />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-sheen-gold [animation-delay:150ms]" />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-sheen-gold [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 border-t border-sheen-cream p-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('typeMessage')}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-sheen-cream bg-sheen-cream/40 px-3 py-2 font-body text-sm text-sheen-black placeholder:text-sheen-muted focus:border-sheen-gold focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
            >
              {t('send')}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
