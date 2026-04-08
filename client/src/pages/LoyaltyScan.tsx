import { useState, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
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
  const [cameraOpen, setCameraOpen] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerDivId = 'qr-scanner'

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const startCamera = async () => {
    setCameraOpen(true)
    // Wait for DOM to render the scanner div
    await new Promise(r => setTimeout(r, 100))

    try {
      const scanner = new Html5Qrcode(scannerDivId)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // QR scanned successfully
          setCode(decodedText)
          stopCamera()
          lookupCard(decodedText)
        },
        () => { /* ignore scan failures */ }
      )
    } catch (err) {
      toast.error(t('cameraError'))
      setCameraOpen(false)
    }
  }

  const stopCamera = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop().catch(() => {})
    }
    setCameraOpen(false)
  }

  const lookupCard = async (qrCode: string) => {
    if (!qrCode.trim()) return
    setLoading(true)
    setCard(null)
    try {
      const { data } = await api.get(`/api/loyalty/scan/${qrCode.trim()}`)
      setCard(data)
    } catch {
      toast.error(t('cardNotFound'))
    }
    setLoading(false)
  }

  const handleLookup = () => lookupCard(code)

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
        {/* Scan input + camera */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-4">
          <h2 className="font-display text-lg text-sheen-black mb-3">{t('scanCustomerCard')}</h2>

          {/* Camera viewer */}
          {cameraOpen && (
            <div className="mb-3">
              <div id={scannerDivId} className="rounded-lg overflow-hidden" />
              <button
                onClick={stopCamera}
                className="w-full mt-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 font-body text-sm font-medium hover:bg-red-100 transition-colors"
              >
                {t('closeCamera')}
              </button>
            </div>
          )}

          {/* Manual input + buttons */}
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              placeholder="SHEEN-XXXXXX"
              className="flex-1 px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
            <Button onClick={handleLookup} disabled={loading || !code.trim()}>
              {loading ? '...' : t('lookup')}
            </Button>
          </div>

          {!cameraOpen && (
            <button
              onClick={startCamera}
              className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sheen-brown text-white font-body text-sm font-medium hover:bg-sheen-brown/90 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              {t('scanWithCamera')}
            </button>
          )}
        </div>

        {/* Card result */}
        {card && (
          <div className="bg-sheen-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <p className="font-body text-lg font-semibold text-sheen-black">{card.name || card.email?.split('@')[0] || 'Customer'}</p>
              {card.email && <p className="font-body text-xs text-sheen-muted">{card.email}</p>}
            </div>

            <div className="px-5 pb-4">
              {/* Visit dots */}
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

              {card.free_cups_available > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-center">
                  <p className="font-body text-sm font-semibold text-green-700">
                    🎉 {card.free_cups_available} {t('freeCupAvailable')}
                  </p>
                </div>
              )}

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
