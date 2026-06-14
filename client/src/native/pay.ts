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

export interface WalletStatus {
  wallet: WalletKind | null
  /** Human-readable reason — 'ok' on success, otherwise why the wallet is hidden.
   * Used by a TEMPORARY on-screen diagnostic; safe to surface (no secrets). */
  reason: string
}

/** Which wallet (if any) the current device can use, plus the reason if none. */
export async function availableWallet(): Promise<WalletStatus> {
  if (!Capacitor.isNativePlatform()) return { wallet: null, reason: 'not a native app' }
  const platform = Capacitor.getPlatform()
  const merchant = import.meta.env.VITE_APPLE_MERCHANT_ID
  try {
    const Stripe = await ensureInit()
    if (platform === 'ios') {
      if (!merchant) return { wallet: null, reason: 'VITE_APPLE_MERCHANT_ID missing from build' }
      await Stripe.isApplePayAvailable() // rejects if unavailable
      return { wallet: 'apple', reason: 'ok' }
    }
    if (platform === 'android') {
      await Stripe.isGooglePayAvailable()
      return { wallet: 'google', reason: 'ok' }
    }
    return { wallet: null, reason: `unsupported platform: ${platform}` }
  } catch (e: any) {
    return { wallet: null, reason: `isApplePayAvailable failed: ${e?.message || String(e)} (merchant=${merchant || 'unset'})` }
  }
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
