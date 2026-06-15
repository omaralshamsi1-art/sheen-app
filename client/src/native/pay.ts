import { Capacitor } from '@capacitor/core'

/**
 * Native Apple Pay / Google Pay via @capacitor-community/stripe.
 * Used only inside the native app — on the web everything returns early.
 *
 * Every native call is wrapped in a timeout so a hung plugin call can never
 * freeze the UI (which previously left the wallet button stuck "checking…").
 */

export type WalletKind = 'apple' | 'google'

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT@${label} (${ms}ms)`)), ms)),
  ])
}

// Import + initialize the plugin, timing BOTH steps. The dynamic import is
// timed too: an un-timed import was what left the wallet check stuck on
// "checking…" forever. This mirrors the diagnostic that proved Apple Pay works.
async function loadStripe() {
  const mod = await withTimeout(import('@capacitor-community/stripe'), 8000, 'import')
  await withTimeout(
    mod.Stripe.initialize({ publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '' }),
    8000,
    'initialize',
  )
  return mod
}

export interface WalletStatus {
  wallet: WalletKind | null
  /** 'ok' on success, otherwise why no wallet. Safe to surface (no secrets). */
  reason: string
}

/** Which wallet (if any) the current device can use, plus the reason if none. */
export async function availableWallet(): Promise<WalletStatus> {
  if (!Capacitor.isNativePlatform()) return { wallet: null, reason: 'not a native app' }
  const platform = Capacitor.getPlatform()
  const merchant = import.meta.env.VITE_APPLE_MERCHANT_ID
  try {
    const { Stripe } = await loadStripe()
    if (platform === 'ios') {
      if (!merchant) return { wallet: null, reason: 'VITE_APPLE_MERCHANT_ID missing from build' }
      await withTimeout(Stripe.isApplePayAvailable(), 8000, 'isApplePayAvailable')
      return { wallet: 'apple', reason: 'ok' }
    }
    if (platform === 'android') {
      await withTimeout(Stripe.isGooglePayAvailable(), 8000, 'isGooglePayAvailable')
      return { wallet: 'google', reason: 'ok' }
    }
    return { wallet: null, reason: `unsupported platform: ${platform}` }
  } catch (e: any) {
    return { wallet: null, reason: `failed: ${e?.message || String(e)}` }
  }
}

/** Present the native wallet sheet for an existing PaymentIntent. Returns true if paid. */
export async function payWithWallet(
  kind: WalletKind,
  clientSecret: string,
  amount: number,
): Promise<boolean> {
  const { Stripe, ApplePayEventsEnum, GooglePayEventsEnum } = await loadStripe()
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
