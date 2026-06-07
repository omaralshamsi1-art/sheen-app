import { useEffect, useState } from 'react'
import api from '../lib/api'
import Button from './ui/Button'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'

/**
 * Admin controls for: (1) enabling/disabling card / online payment, and
 * (2) the loyalty threshold (visits needed for a free cup). Both persist via the
 * generic app_settings store.
 */
export default function LoyaltyPaymentSettings() {
  const { t } = useLanguage()
  const [cardEnabled, setCardEnabled] = useState(true)
  const [visits, setVisits] = useState('6')
  const [savingVisits, setSavingVisits] = useState(false)

  useEffect(() => {
    api.get('/api/settings/card_payment_enabled')
      .then(({ data }) => setCardEnabled(data === null ? true : data === true))
      .catch(() => {})
    api.get('/api/settings/loyalty_visits_for_free')
      .then(({ data }) => { const n = Number(data); if (Number.isFinite(n) && n >= 1) setVisits(String(Math.floor(n))) })
      .catch(() => {})
  }, [])

  const toggleCard = async () => {
    const next = !cardEnabled
    setCardEnabled(next)
    try {
      await api.put('/api/settings/card_payment_enabled', { value: next })
      toast.success(next ? t('cardPaymentOn') : t('cardPaymentOff'))
    } catch {
      setCardEnabled(!next)
      toast.error(t('saveFailed'))
    }
  }

  const saveVisits = async () => {
    const n = Math.floor(Number(visits))
    if (!Number.isFinite(n) || n < 1) { toast.error(t('invalidNumber')); return }
    setSavingVisits(true)
    try {
      await api.put('/api/settings/loyalty_visits_for_free', { value: n })
      setVisits(String(n))
      toast.success(t('saved'))
    } catch {
      toast.error(t('saveFailed'))
    }
    setSavingVisits(false)
  }

  return (
    <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
      <h2 className="font-display text-lg text-sheen-black mb-3">{t('paymentAndLoyalty')}</h2>

      {/* Card / online payment toggle */}
      <div className="flex items-center justify-between py-2">
        <div className="pr-3">
          <p className="font-body text-sm font-medium text-sheen-black">{t('cardPayment')}</p>
          <p className="font-body text-xs text-sheen-muted mt-0.5">{t('cardPaymentDesc')}</p>
        </div>
        <button
          onClick={toggleCard}
          role="switch"
          aria-checked={cardEnabled}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${cardEnabled ? 'bg-sheen-brown' : 'bg-sheen-muted/40'}`}
        >
          <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${cardEnabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {/* Loyalty threshold */}
      <div className="border-t border-sheen-cream mt-3 pt-3">
        <p className="font-body text-sm font-medium text-sheen-black">{t('visitsForFreeCup')}</p>
        <p className="font-body text-xs text-sheen-muted mt-0.5 mb-2">{t('visitsForFreeCupDesc')}</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={50}
            value={visits}
            onChange={(e) => setVisits(e.target.value)}
            className="w-24 px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
          />
          <Button onClick={saveVisits} disabled={savingVisits}>
            {savingVisits ? t('saving') : t('save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
