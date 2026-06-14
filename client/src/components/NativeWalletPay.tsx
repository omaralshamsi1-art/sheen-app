import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { availableWallet, payWithWallet, type WalletKind } from '../native/pay'
import { useLanguage } from '../i18n/LanguageContext'

interface Props {
  clientSecret: string
  amount: number
  onSuccess: (paymentIntentId: string) => void
}

/**
 * Native Apple Pay / Google Pay button. Renders nothing on the web or when no
 * wallet is available, so the standard card form below it is the only UI there.
 */
export default function NativeWalletPay({ clientSecret, amount, onSuccess }: Props) {
  const { t } = useLanguage()
  const [wallet, setWallet] = useState<WalletKind | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    availableWallet().then((s) => {
      setWallet(s.wallet)
      setReason(s.reason)
    })
  }, [])

  if (!wallet) {
    // TEMPORARY diagnostic: surface why the native wallet button is hidden so we
    // can tell apart "no card in Wallet" / "merchant id missing" / etc. Only shows
    // inside the native app (web returns 'not a native app' → nothing rendered).
    // Remove once Apple Pay is confirmed working.
    if (reason && reason !== 'not a native app' && reason !== 'ok') {
      return (
        <div className="mb-3 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-[11px] text-yellow-800 font-body break-words">
          Apple Pay debug: {reason}
        </div>
      )
    }
    return null
  }

  const pay = async () => {
    setBusy(true)
    try {
      const paid = await payWithWallet(wallet, clientSecret, amount)
      if (paid) {
        // PaymentIntent id is the part of the client secret before "_secret"
        onSuccess(clientSecret.split('_secret')[0])
      }
    } catch (e: any) {
      toast.error(e?.message || t('paymentFailed'))
    }
    setBusy(false)
  }

  return (
    <div className="mb-3">
      <button
        onClick={pay}
        disabled={busy}
        className="w-full bg-sheen-black text-sheen-cream rounded-xl py-3 font-body text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {busy ? t('processing') : wallet === 'apple' ? ' Pay' : 'G Pay'}
      </button>
      <div className="flex items-center gap-3 my-3">
        <div className="flex-1 h-px bg-sheen-muted/30" />
        <span className="font-body text-xs text-sheen-muted">{t('orPayByCard')}</span>
        <div className="flex-1 h-px bg-sheen-muted/30" />
      </div>
    </div>
  )
}
