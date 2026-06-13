import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

// Brand
const DARK = '#1A1A1A'
const GOLD = '#D4A843'
const MUTED = '#8c8c8c'

const OUT = new URL('../assets/', import.meta.url)
await mkdir(OUT, { recursive: true })

const png = (svg, file) =>
  sharp(Buffer.from(svg)).png().toFile(new URL(file, OUT).pathname)

// Vertically-centered cap text baseline for a given font size
const baseline = (cy, size) => cy + size * 0.34

// ── App icon (1024) — gold "S" monogram on dark ──
const iconSize = 1024
const sFont = 620
const iconOnly = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}">
  <rect width="${iconSize}" height="${iconSize}" fill="${DARK}"/>
  <text x="${iconSize / 2}" y="${baseline(iconSize / 2, sFont)}" font-family="DejaVu Serif" font-weight="bold"
    font-size="${sFont}" fill="${GOLD}" text-anchor="middle">S</text>
</svg>`

// ── Adaptive icon foreground (transparent, S kept inside the ~66% safe zone) ──
const fgFont = 430
const iconForeground = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}">
  <text x="${iconSize / 2}" y="${baseline(iconSize / 2, fgFont)}" font-family="DejaVu Serif" font-weight="bold"
    font-size="${fgFont}" fill="${GOLD}" text-anchor="middle">S</text>
</svg>`

const iconBackground = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}">
  <rect width="${iconSize}" height="${iconSize}" fill="${DARK}"/>
</svg>`

// ── Splash (2732) — SHEEN wordmark + subtitle on dark ──
const sp = 2732
const wordFont = 300
const subFont = 78
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="${sp}" height="${sp}">
  <rect width="${sp}" height="${sp}" fill="${DARK}"/>
  <text x="${sp / 2}" y="${baseline(sp / 2, wordFont) - 40}" font-family="DejaVu Serif" font-weight="bold"
    font-size="${wordFont}" letter-spacing="36" fill="${GOLD}" text-anchor="middle">SHEEN</text>
  <text x="${sp / 2}" y="${sp / 2 + 200}" font-family="DejaVu Sans"
    font-size="${subFont}" letter-spacing="28" fill="${MUTED}" text-anchor="middle">SPECIALITY COFFEE</text>
</svg>`

await Promise.all([
  png(iconOnly, 'icon-only.png'),
  png(iconForeground, 'icon-foreground.png'),
  png(iconBackground, 'icon-background.png'),
  png(splash, 'splash.png'),
  png(splash, 'splash-dark.png'),
])

console.log('Generated source assets in client/assets/')
