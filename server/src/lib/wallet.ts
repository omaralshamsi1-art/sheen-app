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

// The SHEEN emblem (pour-over funnel + drop), drawn in white. Coordinates live
// in a 1024 space; the viewBox below crops tightly to the mark.
const EMBLEM = `
  <g stroke="#ffffff" stroke-width="17" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M360,392 L664,392"/>
    <path d="M360,392 L512,600"/>
    <path d="M664,392 L512,600"/>
    <path d="M398,556 L626,556"/>
    <path d="M455,402 Q520,500 560,556"/>
    <path d="M497,402 Q548,492 588,556"/>
    <path d="M539,402 Q578,486 612,556"/>
  </g>
  <path d="M512,606 C526,626 529,642 512,657 C495,642 498,626 512,606 Z" fill="#ffffff"/>`
const EMBLEM_VIEWBOX = '336 374 352 300'

// Emblem placed/scaled anywhere via a nested <svg> with the cropped viewBox
function emblemTag(x: number, y: number, w: number, h: number): string {
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${EMBLEM_VIEWBOX}" preserveAspectRatio="xMidYMid meet">${EMBLEM}</svg>`
}

// Square app icon: emblem on the brand dark background
async function iconPng(size: number): Promise<Buffer> {
  const e = size * 0.7
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="100%" height="100%" fill="#1A1A1A"/>
    ${emblemTag((size - e) / 2, (size - e) / 2, e, e)}
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

// Wide logo for the pass header: emblem on a TRANSPARENT background (no dark box)
async function logoPng(width: number, height: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${emblemTag(0, 0, height * 1.1, height)}
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

// One coffee-cup "stamp" — solid when earned, faded when still to collect
function cupSvg(cx: number, cy: number, hw: number, hh: number, filled: boolean): string {
  const topY = cy - hh, botY = cy + hh
  const tw = hw, bw = hw * 0.74
  const sw = Math.max(2.5, hw * 0.055)
  const op = filled ? 1 : 0.22
  const eS = hw * 1.25
  return `<g opacity="${op}">
    <path d="M ${cx - tw} ${topY} L ${cx + tw} ${topY} L ${cx + bw} ${botY} L ${cx - bw} ${botY} Z"
      fill="#141414" stroke="#ffffff" stroke-width="${sw}" stroke-linejoin="round"/>
    <ellipse cx="${cx}" cy="${topY}" rx="${tw}" ry="${hh * 0.15}" fill="#ffffff"/>
    <rect x="${cx - bw}" y="${botY - sw}" width="${bw * 2}" height="${sw * 2.4}" rx="${sw}" fill="#ffffff"/>
    ${emblemTag(cx - eS / 2, cy - eS * 0.46, eS, eS * 0.85)}
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
    iconPng(29),
    iconPng(58),
    iconPng(87),
    logoPng(160, 50),
    logoPng(320, 100),
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
