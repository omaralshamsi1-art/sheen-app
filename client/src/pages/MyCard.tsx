import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import api from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../i18n/LanguageContext'
import TopBar from '../components/layout/TopBar'

const VISITS_FOR_FREE = 6

interface LoyaltyCard {
  id: string
  qr_code: string
  total_visits: number
  free_cups_earned: number
  free_cups_used: number
  name: string | null
  email: string | null
}

export default function MyCard() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [card, setCard] = useState<LoyaltyCard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      try {
        const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0]
        const { data } = await api.get('/api/loyalty/my-card', {
          params: { user_id: user.id, email: user.email, name },
        })
        setCard(data)
      } catch { /* ignore */ }
      setLoading(false)
    }
    fetch()
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-sheen-cream">
        <TopBar title={t('myCard')} />
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-sheen-brown border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!card) return null

  const visitsToward = card.total_visits % VISITS_FOR_FREE
  const visitsRemaining = VISITS_FOR_FREE - visitsToward
  const freeCups = card.free_cups_earned - card.free_cups_used
  const progress = (visitsToward / VISITS_FOR_FREE) * 100

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('myCard')} />

      <main className="max-w-md mx-auto px-4 py-6">
        {/* Card */}
        <div className="bg-sheen-black rounded-2xl overflow-hidden shadow-lg">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 text-center">
            <h2 className="font-display text-3xl font-bold text-sheen-gold tracking-wider">SHEEN</h2>
            <p className="font-body text-xs text-gray-400 mt-1">{t('loyaltyCard')}</p>
            <p className="font-body text-sm text-sheen-cream mt-2 font-medium">
              {card.name || card.email?.split('@')[0] || ''}
            </p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center pb-4">
            <div className="bg-white rounded-xl p-3">
              <QRCodeSVG
                value={card.qr_code}
                size={180}
                bgColor="#FFFFFF"
                fgColor="#1A1A1A"
                level="H"
              />
            </div>
          </div>

          <p className="text-center font-body text-[10px] text-gray-500 pb-2">{card.qr_code}</p>

          {/* Progress */}
          <div className="px-6 pb-6">
            {/* Visit dots */}
            <div className="flex justify-center gap-2 mb-3">
              {Array.from({ length: VISITS_FOR_FREE }).map((_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < visitsToward
                      ? 'bg-sheen-gold text-sheen-black'
                      : 'bg-gray-700 text-gray-500'
                  }`}
                >
                  {i < visitsToward ? '☕' : i + 1}
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
              <div
                className="bg-sheen-gold rounded-full h-2 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-center font-body text-sm text-gray-300">
              {visitsToward > 0
                ? `${visitsRemaining} ${t('visitsToFreeCup')}`
                : t('startCollecting')
              }
            </p>

            {/* Free cups badge */}
            {freeCups > 0 && (
              <div className="mt-3 text-center">
                <span className="inline-flex items-center gap-1.5 bg-sheen-gold text-sheen-black px-4 py-2 rounded-full font-body text-sm font-bold animate-pulse">
                  🎉 {freeCups} {t('freeCupAvailable')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-sheen-white rounded-xl p-4 text-center shadow-sm">
            <p className="font-display text-2xl font-bold text-sheen-brown">{card.total_visits}</p>
            <p className="font-body text-[10px] text-sheen-muted uppercase">{t('totalVisits')}</p>
          </div>
          <div className="bg-sheen-white rounded-xl p-4 text-center shadow-sm">
            <p className="font-display text-2xl font-bold text-sheen-gold">{card.free_cups_earned}</p>
            <p className="font-body text-[10px] text-sheen-muted uppercase">{t('cupsEarned')}</p>
          </div>
          <div className="bg-sheen-white rounded-xl p-4 text-center shadow-sm">
            <p className="font-display text-2xl font-bold text-green-600">{freeCups}</p>
            <p className="font-body text-[10px] text-sheen-muted uppercase">{t('cupsAvailable')}</p>
          </div>
        </div>

        <p className="text-center font-body text-xs text-sheen-muted mt-4">
          {t('loyaltyInfo')}
        </p>
      </main>
    </div>
  )
}
