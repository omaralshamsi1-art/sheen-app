import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useLanguage } from '../i18n/LanguageContext'

const API_BASE = import.meta.env.VITE_API_URL || ''

// Open a URL outside the web view so the OS can hand the pass to Wallet
async function openExternal(url: string) {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
  } else {
    window.open(url, '_blank')
  }
}

interface Props {
  userId: string
  email?: string | null
  name?: string | null
}

export default function AddToWallet({ userId, email, name }: Props) {
  const { t } = useLanguage()
  const [status, setStatus] = useState<{ apple: boolean; google: boolean } | null>(null)
  const platform = Capacitor.getPlatform()

  useEffect(() => {
    api
      .get('/api/loyalty/wallet/status')
      .then((r) => setStatus(r.data))
      .catch(() => setStatus({ apple: false, google: false }))
  }, [])

  if (!status) return null

  const showApple = status.apple && (platform === 'ios' || platform === 'web')
  const showGoogle = status.google && (platform === 'android' || platform === 'web')
  if (!showApple && !showGoogle) return null

  const query = new URLSearchParams({ user_id: userId })
  if (email) query.set('email', email)
  if (name) query.set('name', name)

  const addApple = () => openExternal(`${API_BASE}/api/loyalty/wallet/apple?${query.toString()}`)

  const addGoogle = async () => {
    try {
      const { data } = await api.get('/api/loyalty/wallet/google', {
        params: { user_id: userId, email, name },
      })
      await openExternal(data.saveUrl)
    } catch {
      toast.error(t('walletError'))
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {showApple && (
        <button
          onClick={addApple}
          className="flex items-center justify-center gap-2 bg-sheen-black text-sheen-cream rounded-xl py-3 font-body text-sm font-medium hover:opacity-90 transition-opacity"
        >
           {t('addToAppleWallet')}
        </button>
      )}
      {showGoogle && (
        <button
          onClick={addGoogle}
          className="flex items-center justify-center gap-2 bg-sheen-black text-sheen-cream rounded-xl py-3 font-body text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {t('saveToGoogleWallet')}
        </button>
      )}
    </div>
  )
}
