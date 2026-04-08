import { useState } from 'react'
import api from '../lib/api'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'

const VISITS_FOR_FREE = 6

interface CardResult {
  id: string
  qr_code: string
  name: string | null
  email: string | null
  total_visits: number
  free_cups_earned: number
  free_cups_used: number
  visits_toward_free: number
  visits_remaining: number
  free_cups_available: number
  earned_free_cup?: boolean
}

export default function LoyaltyScan() {
  const { t } = useLanguage()
  const [code, setCode] = useState('')
  const [card, setCard] = useState<CardResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const handleLookup = async () => {
    if (!code.trim()) return
    setLoading(true)
    setCard(null)
    try {
      const { data } = await api.get(`/api/loyalty/scan/${code.trim()}`)
      setCard(data)
    } catch {
      toast.error(t('cardNotFound'))
    }
    setLoading(false)
  }

  const handleAddVisit = async () => {
    if (!card) return
    setActionLoading(true)
    try {
      const { data } = await api.post('/api/loyalty/add-visit', { qr_code: card.qr_code })
      setCard(data)
      if (data.earned_free_cup) {
        toast.success(`🎉 ${card.name || 'Customer'} ${t('earnedFreeCup')}!`, { duration: 5000 })
      } else {
        toast.success(`${t('visitAdded')} — ${data.visits_remaining} ${t('visitsToFreeCup')}`)
      }
    } catch {
      toast.error('Failed')
    }
    setActionLoading(false)
  }

  const handleRedeem = async () => {
    if (!card) return
    setActionLoading(true)
    try {
      const { data } = await api.post('/api/loyalty/redeem', { qr_code: card.qr_code })
      setCard(data)
      toast.success(`☕ ${t('freeCupRedeemed')}!`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed')
    }
    setActionLoading(false)
  }

  const visitsToward = card ? card.total_visits % VISITS_FOR_FREE : 0

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('loyaltyScan')} />

      <main className="max-w-md mx-auto px-4 py-6">
        {/* Scan input */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-4">
          <h2 className="font-display text-lg text-sheen-black mb-3">{t('scanCustomerCard')}</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              placeholder="SHEEN-XXXXXX"
              className="flex-1 px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              autoFocus
            />
            <Button onClick={handleLookup} disabled={loading || !code.trim()}>
              {loading ? '...' : t('lookup')}
            </Button>
          </div>
        </div>

        {/* Card result */}
        {card && (
          <div className="bg-sheen-white rounded-xl shadow-sm overflow-hidden">
            {/* Customer info */}
            <div className="px-5 pt-5 pb-3">
              <p className="font-body text-lg font-semibold text-sheen-black">{card.name || card.email?.split('@')[0] || 'Customer'}</p>
              {card.email && <p className="font-body text-xs text-sheen-muted">{card.email}</p>}
            </div>

            {/* Visit progress */}
            <div className="px-5 pb-4">
              <div className="flex justify-center gap-2 mb-3">
                {Array.from({ length: VISITS_FOR_FREE }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      i < visitsToward
                        ? 'bg-sheen-gold text-sheen-black'
                        : 'bg-sheen-cream text-sheen-muted'
                    }`}
                  >
                    {i < visitsToward ? '☕' : i + 1}
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-xs font-body text-sheen-muted mb-4">
                <span>{t('totalVisits')}: {card.total_visits}</span>
                <span>{card.visits_remaining} {t('visitsToFreeCup')}</span>
              </div>

              {/* Free cups available */}
              {card.free_cups_available > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-center">
                  <p className="font-body text-sm font-semibold text-green-700">
                    🎉 {card.free_cups_available} {t('freeCupAvailable')}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button onClick={handleAddVisit} disabled={actionLoading} className="flex-1">
                  {actionLoading ? '...' : `+ ${t('addVisit')}`}
                </Button>
                {card.free_cups_available > 0 && (
                  <button
                    onClick={handleRedeem}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 rounded-lg bg-green-500 text-white font-body text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {`☕ ${t('redeemFreeCup')}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
