# Store Screenshots & Graphics

Text copy, the feature graphic, and the app icon are ready. **Screenshots must be
captured from the running app** on a device/simulator — they can't be generated
headless. This is the exact plan.

## Ready-made graphics (in this folder / repo)
- **App icon (512×512 / 1024×1024):** export from `client/assets/icon-only.png`
- **Play feature graphic (1024×500):** `store/feature-graphic.png` ✅

## Required sizes
**Apple App Store** (upload the 6.9" set; Apple down-scales for other sizes)
- iPhone 6.9": **1320×2868** (portrait) — required
- iPad 13": **2048×2732** — required *only if you keep iPad support*. To avoid
  needing iPad shots, set the iOS target to **iPhone only** in Xcode.

**Google Play**
- Phone screenshots: **1080×2400** (or any 9:16), 2–8 images
- Feature graphic: 1080×500 → use `store/feature-graphic.png`

## How to capture
- **iOS:** `cd client && npm run cap:ios` → run on the iPhone 16 Pro Max simulator
  → `Cmd+S` saves a screenshot at the right resolution.
- **Android:** `cd client && npm run cap:android` → run on a Pixel emulator →
  use the camera button in the emulator toolbar.
- Build with `VITE_API_URL` pointing at Railway so real menu/data shows.

## The 6 screens to capture (with caption overlays)
Capture these flows; add the short caption as a text banner above each (use any
template tool — Figma, Canva, or Apple's screenshot framing):

1. **Menu** — "Your favourites, ready to order"
2. **Customise a drink** (beans/milk/add-ons) — "Made exactly how you like it"
3. **Cart / checkout showing Apple Pay** — "Pay in seconds with Apple Pay"
4. **My Card loyalty screen with Add to Wallet** — "Earn a free cup every 6 visits"
5. **Order tracking / My Orders** — "Track every order"
6. **A discount push notification** (or offers) — "Never miss an offer"

Tip: use the brand background `#1A1A1A` and gold `#D4A843` for caption banners so
they match the app icon and feature graphic.

## Suggested first 3 (if you only do the minimum)
1, 3, 4 — Menu, Apple Pay checkout, Loyalty + Wallet. These tell the whole story.
