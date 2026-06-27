import { PKPass } from 'passkit-generator'
import jwt from 'jsonwebtoken'
import sharp from 'sharp'
import path from 'path'
import { walletAuthToken } from './walletPush'

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

// Real image assets (committed under server/assets). Read relative to this
// compiled file (dist/lib) so it works regardless of the runtime cwd.
const ASSET_DIR = path.join(__dirname, '..', '..', 'assets')
const CUP_PATH = path.join(ASSET_DIR, 'cup.png')
const LOGO_PATH = path.join(ASSET_DIR, 'pass-logo.png')

// Flood-fill from the borders, making background pixels transparent. Keeps
// interior pixels (e.g. the white emblem inside the cup) intact.
async function keyOutBackground(
  file: string,
  isBg: (r: number, g: number, b: number) => boolean,
): Promise<Buffer> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const ch = info.channels
  const seen = new Uint8Array(width * height)
  const stack: number[] = []
  const push = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < width && y < height) stack.push(y * width + x) }
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1) }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y) }
  while (stack.length) {
    const p = stack.pop()!
    if (seen[p]) continue
    const o = p * ch
    if (!isBg(data[o], data[o + 1], data[o + 2])) continue
    seen[p] = 1
    data[o + 3] = 0
    const x = p % width, y = (p / width) | 0
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }
  return sharp(data, { raw: { width, height, channels: ch } }).png().toBuffer()
}

// Memoized transparent versions of the real assets
let _cup: Promise<Buffer> | null = null
let _logo: Promise<Buffer> | null = null
const cupTransparent = () => (_cup ??= keyOutBackground(CUP_PATH, (r, g, b) => r > 236 && g > 236 && b > 236))
const logoTransparent = () => (_logo ??= keyOutBackground(LOGO_PATH, (r, g, b) => r < 75 && g < 75 && b < 75))

// Square app icon: the logo emblem on the brand dark background
async function iconPng(size: number): Promise<Buffer> {
  const e = Math.round(size * 0.74)
  const logo = await sharp(await logoTransparent())
    .resize(e, e, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 26, g: 26, b: 26, alpha: 1 } } })
    .composite([{ input: logo, gravity: 'center' }])
    .png().toBuffer()
}

// Compact square emblem for the pass header, leaving room for the gold
// logoText (brand name "SHEEN Cafe · Speciality Coffee") that sits beside it.
async function logoPng(side: number): Promise<Buffer> {
  return sharp(await logoTransparent())
    .resize(side, side, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()
}

// Strip image: a 2×3 grid of the real cup photo, `filled` of them full colour,
// the rest faded to show remaining stamps.
async function cupStripPng(filled: number, total: number, w: number, h: number): Promise<Buffer> {
  const cols = 3
  const rows = Math.ceil(total / cols)
  const cellW = w / cols
  const cellH = h / rows
  const cupH = Math.round(cellH * 0.92)
  const cupFull = await sharp(await cupTransparent())
    .resize({ height: cupH, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()
  const meta = await sharp(cupFull).metadata()
  const cupW = meta.width || Math.round(cellW * 0.6)
  // Faded copy: multiply alpha down via a dest-in overlay
  const fade = await sharp({ create: { width: cupW, height: cupH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.22 } } }).png().toBuffer()
  const cupFaded = await sharp(cupFull).composite([{ input: fade, blend: 'dest-in' }]).png().toBuffer()

  const layers = []
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / cols)
    const c = i % cols
    layers.push({
      input: i < filled ? cupFull : cupFaded,
      left: Math.round(c * cellW + (cellW - cupW) / 2),
      top: Math.round(r * cellH + (cellH - cupH) / 2),
    })
  }
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .png().toBuffer()
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
    logoPng(50),
    logoPng(100),
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
      logoText: 'SHEEN Cafe · Speciality Coffee',
      serialNumber: card.qr_code,
      backgroundColor: 'rgb(43, 43, 43)',
      foregroundColor: 'rgb(212, 168, 67)',
      labelColor: 'rgb(170, 170, 170)',
      // When the PassKit web service is configured, these let the pass
      // auto-update (Apple polls/pushes via this URL using the token).
      ...(process.env.WALLET_WEB_SERVICE_URL
        ? {
            webServiceURL: process.env.WALLET_WEB_SERVICE_URL,
            authenticationToken: walletAuthToken(card.qr_code),
          }
        : {}),
    },
  )

  pass.type = 'storeCard'

  // Visits toward the next free cup, shown as a number (e.g. 3/6) like the app.
  pass.headerFields.push({
    key: 'visits',
    label: 'VISITS',
    value: `${visitsToward}/${visitsForFree}`,
  })

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
