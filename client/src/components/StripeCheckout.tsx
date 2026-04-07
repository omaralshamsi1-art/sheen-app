import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { useLanguage } from '../i18n/LanguageContext'
import Button from './ui/Button'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

interface CheckoutFormProps {
  onSuccess: (paymentIntentId: string) => void
  onCancel: () => void
  amount: number
}

function CheckoutForm({ onSuccess, onCancel, amount }: CheckoutFormProps) {
  const { t } = useLanguage()
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (result.error) {
      setError(result.error.message ?? 'Payment failed')
      setLoading(false)
    } else if (result.paymentIntent?.status === 'succeeded') {
      onSuccess(result.paymentIntent.id)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          wallets: { applePay: 'auto', googlePay: 'auto' },
        }}
      />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-body">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={!stripe || loading} className="flex-1">
          {loading ? t('processing') : `${t('pay')} ${amount.toFixed(2)} AED`}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-body text-sheen-muted hover:text-sheen-black transition-colors"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}

interface StripeCheckoutProps {
  clientSecret: string
  amount: number
  onSuccess: (paymentIntentId: string) => void
  onCancel: () => void
}

export default function StripeCheckout({ clientSecret, amount, onSuccess, onCancel }: StripeCheckoutProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#8B4513',
            colorBackground: '#FFFFFF',
            fontFamily: '"DM Sans", sans-serif',
            borderRadius: '8px',
          },
        },
      }}
    >
      <CheckoutForm onSuccess={onSuccess} onCancel={onCancel} amount={amount} />
    </Elements>
  )
}
