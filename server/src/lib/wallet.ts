import { PKPass } from 'passkit-generator'
import jwt from 'jsonwebtoken'
import sharp from 'sharp'

/**
 * Apple Wallet (.pkpass) + Google Wallet loyalty pass generation for SHEEN.
 *
 * Both providers stay dormant until their credentials are present in the
 * environment, so the API responds with a clear "not configured" message
 * instead of crashing. See MOBILE_APP_SETUP.md for how to obtain each value.
 */

const DEFAULT_VISITS_FOR_FREE_CUP = 6

export interface LoyaltyCardData {
  qr_code: string
  name: string | null
  email: string | null
  total_visits: number
  free_cups_earned: number
  free_cups_used: number
}

function progress(card: LoyaltyCardData, visitsForFree: number) {
  const visitsToward = card.total_visits % visitsForFree
  const freeCups = Math.max(0, card.free_cups_earned - card.free_cups_used)
  return { visitsToward, freeCups }
}

function b64(value?: string): Buffer | undefined {
  return value ? Buffer.from(value, 'base64') : undefined
}

function storeLocation(): { latitude: number; longitude: number } | null {
  const lat = Number(process.env.SHEEN_STORE_LAT)
  const lng = Number(process.env.SHEEN_STORE_LNG)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng }
  return null
}

/* ---------------------------------------------------------------- Apple --- */

export function isAppleWalletConfigured(): boolean {
  return Boolean(
    process.env.APPLE_PASS_TYPE_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_PASS_CERT &&
      process.env.APPLE_PASS_KEY &&
      process.env.APPLE_WWDR_CERT,
  )
}

// Branded square logo, rendered as PNG via sharp (replaceable by a real asset later)
async function brandPng(width: number, height: number): Promise<Buffer> {
  const fontSize = Math.floor(height * 0.6)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#1A1A1A"/>
    <text x="50%" y="50%" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}"
      font-weight="bold" fill="#D4A843" text-anchor="middle" dominant-baseline="central">S</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

// One coffee-cup "stamp" — solid when earned, faded when still to collect
function cupSvg(cx: number, cy: number, hw: number, hh: number, filled: boolean): string {
  const topY = cy - hh, botY = cy + hh
  const tw = hw, bw = hw * 0.72
  const sw = Math.max(3, hw * 0.07)
  const op = filled ? 1 : 0.25
  const eW = hw * 0.5
  const eTop = cy - hh * 0.38, eBot = cy + hh * 0.18
  return `<g opacity="${op}">
    <path d="M ${cx - tw} ${topY} L ${cx + tw} ${topY} L ${cx + bw} ${botY} L ${cx - bw} ${botY} Z"
      fill="#1A1A1A" stroke="#fff" stroke-width="${sw}" stroke-linejoin="round"/>
    <ellipse cx="${cx}" cy="${topY}" rx="${tw}" ry="${hh * 0.13}" fill="#fff"/>
    <path d="M ${cx - bw} ${botY} L ${cx + bw} ${botY}" stroke="#fff" stroke-width="${sw * 1.5}" stroke-linecap="round"/>
    <g stroke="#fff" stroke-width="${sw * 0.85}" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M ${cx - eW} ${eTop} L ${cx + eW} ${eTop}"/>
      <path d="M ${cx - eW} ${eTop} L ${cx} ${eBot}"/>
      <path d="M ${cx + eW} ${eTop} L ${cx} ${eBot}"/>
    </g>
    <path d="M ${cx} ${eBot + hh * 0.04} c ${hw * 0.07} ${hh * 0.1} ${hw * 0.07} ${hh * 0.18} 0 ${hh * 0.22}
      c ${-hw * 0.07} ${-hh * 0.04} ${-hw * 0.07} ${-hh * 0.12} 0 ${-hh * 0.22} Z" fill="#fff"/>
  </g>`
}

// Strip image: a 2×3 grid of cup stamps, `filled` of them solid
async function cupStripPng(filled: number, total: number, w: number, h: number): Promise<Buffer> {
  const cols = 3
  const rows = Math.ceil(total / cols)
  const cellW = w / cols
  const cellH = h / rows
  let cups = ''
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / cols)
    const c = i % cols
    cups += cupSvg(c * cellW + cellW / 2, r * cellH + cellH / 2, cellW * 0.28, cellH * 0.32, i < filled)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${cups}</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

export async function generateApplePass(
  card: LoyaltyCardData,
  visitsForFree: number = DEFAULT_VISITS_FOR_FREE_CUP,
): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new Error('Apple Wallet is not configured')
  }

  const { visitsToward, freeCups } = progress(card, visitsForFree)

  const [icon, icon2x, icon3x, logo, logo2x, strip1x, strip2x, strip3x] = await Promise.all([
    brandPng(29, 29),
    brandPng(58, 58),
    brandPng(87, 87),
    brandPng(160, 50),
    brandPng(320, 100),
    cupStripPng(visitsToward, visitsForFree, 375, 144),
    cupStripPng(visitsToward, visitsForFree, 750, 288),
    cupStripPng(visitsToward, visitsForFree, 1125, 432),
  ])

  const pass = new PKPass(
    {
      'icon.png': icon,
      'icon@2x.png': icon2x,
      'icon@3x.png': icon3x,
      'logo.png': logo,
      'logo@2x.png': logo2x,
      'strip.png': strip1x,
      'strip@2x.png': strip2x,
      'strip@3x.png': strip3x,
    },
    {
      wwdr: b64(process.env.APPLE_WWDR_CERT)!,
      signerCert: b64(process.env.APPLE_PASS_CERT)!,
      signerKey: b64(process.env.APPLE_PASS_KEY)!,
      signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE || undefined,
    },
    {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
      teamIdentifier: process.env.APPLE_TEAM_ID!,
      organizationName: 'SHEEN CAFE',
      description: 'SHEEN Loyalty Card',
      serialNumber: card.qr_code,
      backgroundColor: 'rgb(43, 43, 43)',
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(170, 170, 170)',
    },
  )

  pass.type = 'storeCard'

  // Cups are shown via the strip image; fields below it: NAME + GIFT (rewards)
  pass.secondaryFields.push(
    { key: 'name', label: 'NAME', value: card.name || card.email?.split('@')[0] || 'SHEEN' },
    { key: 'gift', label: 'GIFT', value: `${freeCups} ${freeCups === 1 ? 'reward' : 'rewards'}`, textAlignment: 'PKTextAlignmentRight' },
  )
  pass.backFields.push({
    key: 'about',
    label: 'How it works',
    value: `Collect ${visitsForFree} visits to earn a free cup. Show this card to be scanned on each visit.`,
  })

  pass.setBarcodes({
    message: card.qr_code,
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
    altText: card.qr_code,
  })

  // Relevant location → iOS shows the pass on the lock screen when near the cafe
  const loc = storeLocation()
  if (loc) {
    pass.setLocations({
      latitude: loc.latitude,
      longitude: loc.longitude,
      relevantText: 'SHEEN is nearby ☕ Come grab your coffee!',
    })
  }

  return pass.getAsBuffer()
}

/* --------------------------------------------------------------- Google --- */

export function isGoogleWalletConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
      process.env.GOOGLE_WALLET_SA_EMAIL &&
      process.env.GOOGLE_WALLET_SA_KEY &&
      process.env.GOOGLE_WALLET_CLASS_ID,
  )
}

export function buildGoogleSaveUrl(
  card: LoyaltyCardData,
  visitsForFree: number = DEFAULT_VISITS_FOR_FREE_CUP,
): string {
  if (!isGoogleWalletConfigured()) {
    throw new Error('Google Wallet is not configured')
  }

  const { visitsToward, freeCups } = progress(card, visitsForFree)
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!
  const classId = process.env.GOOGLE_WALLET_CLASS_ID! // e.g. `${issuerId}.sheen_loyalty`
  const objectId = `${issuerId}.${card.qr_code.replace(/[^\w.-]/g, '_')}`

  const loc = storeLocation()
  const loyaltyObject: Record<string, unknown> = {
    id: objectId,
    classId,
    state: 'ACTIVE',
    accountName: card.name || card.email?.split('@')[0] || 'SHEEN Member',
    accountId: card.qr_code,
    loyaltyPoints: {
      label: 'Visits',
      balance: { string: `${visitsToward} / ${visitsForFree}` },
    },
    secondaryLoyaltyPoints: {
      label: 'Free cups',
      balance: { int: freeCups },
    },
    barcode: { type: 'QR_CODE', value: card.qr_code, alternateText: card.qr_code },
    ...(loc ? { locations: [{ latitude: loc.latitude, longitude: loc.longitude }] } : {}),
  }

  const claims = {
    iss: process.env.GOOGLE_WALLET_SA_EMAIL,
    aud: 'google',
    typ: 'savetowallet',
    origins: [] as string[],
    payload: { loyaltyObjects: [loyaltyObject] },
  }

  // Service-account private key; allow \n-escaped form from a single-line env var
  const privateKey = (process.env.GOOGLE_WALLET_SA_KEY || '').replace(/\\n/g, '\n')
  const token = jwt.sign(claims, privateKey, { algorithm: 'RS256' })
  return `https://pay.google.com/gp/v/save/${token}`
}
