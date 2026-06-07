import { Capacitor } from '@capacitor/core'

/**
 * Native Apple Pay / Google Pay via @capacitor-community/stripe.
 * Used only inside the native app — on the web the existing Stripe
 * PaymentElement already renders Apple/Google Pay buttons, so all of this
 * returns early in the browser.
 */

export type WalletKind = 'apple' | 'google'

let initialized = false

async function ensureInit() {
  const { Stripe } = await import('@capacitor-community/stripe')
  if (!initialized) {
    await Stripe.initialize({ publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '' })
    initialized = true
  }
  return Stripe
}

/** Which wallet (if any) the current device can use. Null on web / unsupported. */
export async function availableWallet(): Promise<WalletKind | null> {
  if (!Capacitor.isNativePlatform()) return null
  const platform = Capacitor.getPlatform()
  try {
    const Stripe = await ensureInit()
    if (platform === 'ios') {
      if (!import.meta.env.VITE_APPLE_MERCHANT_ID) return null // Apple Pay needs a merchant id
      await Stripe.isApplePayAvailable() // rejects if unavailable
      return 'apple'
    }
    if (platform === 'android') {
      await Stripe.isGooglePayAvailable()
      return 'google'
    }
  } catch {
    return null
  }
  return null
}

/** Present the native wallet sheet for an existing PaymentIntent. Returns true if paid. */
export async function payWithWallet(
  kind: WalletKind,
  clientSecret: string,
  amount: number,
): Promise<boolean> {
  const Stripe = await ensureInit()
  const { ApplePayEventsEnum, GooglePayEventsEnum } = await import('@capacitor-community/stripe')
  const paymentSummaryItems = [{ label: 'SHEEN CAFE', amount }]

  if (kind === 'apple') {
    await Stripe.createApplePay({
      paymentIntentClientSecret: clientSecret,
      paymentSummaryItems,
      merchantIdentifier: import.meta.env.VITE_APPLE_MERCHANT_ID as string,
      countryCode: 'AE',
      currency: 'AED',
    })
    const res = await Stripe.presentApplePay()
    return res.paymentResult === ApplePayEventsEnum.Completed
  }

  await Stripe.createGooglePay({
    paymentIntentClientSecret: clientSecret,
    paymentSummaryItems,
    countryCode: 'AE',
    currency: 'AED',
  })
  const res = await Stripe.presentGooglePay()
  return res.paymentResult === GooglePayEventsEnum.Completed
}
