# SHEEN — Native Mobile Apps (Capacitor)

The web app is wrapped with [Capacitor](https://capacitorjs.com) so it can be
submitted to the **Apple App Store** and **Google Play**. The native shells live
under `client/android` and `client/ios` and load the production web build from
`client/dist`.

- **App name:** SHEEN
- **Bundle / App ID:** `ae.sheencafe.app`

---

## How it works

The native app bundles the compiled web app and calls the live Railway API over
HTTPS. There is **no Vercel proxy** inside the app, so the build must point at the
absolute API URL via `VITE_API_URL`.

```
# from the client/ folder — set this to your Railway API domain
VITE_API_URL=https://YOUR-RAILWAY-API.up.railway.app npm run cap:sync
```

`cap:sync` runs `npm run build` then copies `dist/` into both native projects.
Re-run it whenever you change the web app.

---

## Build & run

### Android (works on Windows / macOS / Linux)
Requires **Android Studio** (includes the Android SDK).

```
cd client
VITE_API_URL=https://YOUR-RAILWAY-API npm run cap:android   # builds, syncs, opens Android Studio
```
In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle (.aab)**,
create a signing key, then upload the `.aab` in the Google Play Console.

### iOS (requires a Mac with Xcode)
```
cd client
VITE_API_URL=https://YOUR-RAILWAY-API npm run cap:ios        # builds, syncs, opens Xcode
```
In Xcode: set your Apple Team under **Signing & Capabilities**, then
**Product → Archive → Distribute App** to upload to App Store Connect.

> The `ios/` project was scaffolded on Linux, so its CocoaPods/SPM dependencies
> are resolved the first time you open it on a Mac.

---

## Store accounts & assets (only you can do these)

| Item | Apple | Google |
|---|---|---|
| Developer account | $99 / year | $25 one-time |
| Build machine | Mac + Xcode | Any (Android Studio) |
| Required | App icon, screenshots, privacy policy URL, description | same |
| Review | Manual, ~1–3 days | Mostly automated |

### Likely review requirements to prepare
- **Privacy policy URL** (both stores require one).
- **App icons & splash** — currently a placeholder is used; generate full icon
  sets with `@capacitor/assets` (`npx @capacitor/assets generate`).
- **Permissions usage strings** — the app uses the **camera** (QR scanning) and
  **location**. iOS needs `NSCameraUsageDescription` / `NSLocationWhenInUseUsageDescription`
  in `ios/App/App/Info.plist`; Android needs the matching `<uses-permission>` entries.
- **Apple "minimum functionality"** — Apple may reject an app that only mirrors a
  website. Native touches (push notifications, camera, offline) help approval.

---

## Wallet loyalty card (Apple Wallet + Google Wallet)

The loyalty card can be saved to **Apple Wallet** and **Google Wallet**. The
"Add to Wallet" buttons appear on the *My Card* screen **only once the matching
credentials are set** — until then the endpoints return `501` and the buttons
stay hidden. Setting the cafe coordinates also makes the pass surface on the
lock screen when the customer is near the shop.

Set these on the **Railway** server:

```
SHEEN_STORE_LAT=25.20            # cafe latitude  (lock-screen "we're nearby")
SHEEN_STORE_LNG=55.27            # cafe longitude

# Apple Wallet — values are base64-encoded PEM strings
APPLE_PASS_TYPE_ID=pass.ae.sheencafe.loyalty
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_PASS_CERT=...              # base64 of the Pass Type ID signing cert (PEM)
APPLE_PASS_KEY=...               # base64 of its private key (PEM)
APPLE_PASS_KEY_PASSPHRASE=...    # if the key has one
APPLE_WWDR_CERT=...              # base64 of Apple WWDR G4 cert (PEM)

# Google Wallet
GOOGLE_WALLET_ISSUER_ID=...      # from the Google Wallet console
GOOGLE_WALLET_SA_EMAIL=...       # service-account email
GOOGLE_WALLET_SA_KEY=...         # service-account private key (\n-escaped is fine)
GOOGLE_WALLET_CLASS_ID=ISSUERID.sheen_loyalty
```

**Where the credentials come from**
- **Apple:** Apple Developer → Identifiers → create a **Pass Type ID**, generate a
  signing certificate, export cert + key as PEM, and download the **WWDR G4**
  cert. Base64-encode each PEM (`base64 -w0 cert.pem`).
- **Google:** [Google Wallet console](https://pay.google.com/business/console) →
  create an **Issuer**, a **Loyalty class** (its id becomes `GOOGLE_WALLET_CLASS_ID`),
  and a **service account** (Google Cloud) with the Wallet API enabled.

> Placeholder pass artwork is generated on the fly (a branded "S"). Drop a real
> logo later by extending `server/src/lib/wallet.ts`.

## Push notifications (discounts & announcements)

Customers who install the app can receive push notifications. An admin sends
them from **Settings → Send Notification** — the card stays hidden until push is
configured on the server. Delivery uses **Firebase Cloud Messaging (FCM)**, which
covers both iOS and Android.

Set on the **Railway** server:

```
FIREBASE_SERVICE_ACCOUNT=...     # Firebase service-account JSON (raw or base64)
```

**Setup steps**
1. Create a **Firebase project** and add an **Android app** (package
   `ae.sheencafe.app`) and an **iOS app** (bundle `ae.sheencafe.app`).
2. Download **`google-services.json`** → `client/android/app/`, and
   **`GoogleService-Info.plist`** → `client/ios/App/App/` (add it in Xcode).
3. For iOS, upload your **APNs key** in Firebase → Project Settings → Cloud
   Messaging, and enable the **Push Notifications** capability in Xcode.
4. Create a **service account** (Firebase → Project Settings → Service accounts →
   Generate key) and put its JSON in `FIREBASE_SERVICE_ACCOUNT`.

Apply the new DB table once: run `supabase/migrations/023_push_tokens.sql`.

The app asks the customer for notification permission after login and registers
the device token automatically. Invalid tokens are pruned on send.

## Apple Pay / Google Pay

Payments go through **Stripe** (coffee is a physical good, so Apple allows
Stripe/Apple Pay — IAP is only for digital goods).

- **Web / PWA:** Apple Pay & Google Pay already appear automatically in the
  Stripe `PaymentElement` — nothing to configure beyond Stripe itself.
- **Native app:** uses the native Stripe SDK (`@capacitor-community/stripe`) to
  present the real Apple Pay / Google Pay sheets. The wallet button only shows
  when the device supports it (and, for Apple, when a merchant id is set).

**Config**
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...      # already used by the web app
VITE_APPLE_MERCHANT_ID=merchant.ae.sheencafe # build-time, for native Apple Pay
```

**Apple Pay setup**
1. Apple Developer → Identifiers → **Merchant IDs** → create `merchant.ae.sheencafe`.
2. In Xcode → target **App** → Signing & Capabilities → add **Apple Pay** and
   tick that merchant id.
3. In the **Stripe Dashboard** → Settings → Payment methods → Apple Pay, register
   the merchant / add the platform.
4. Build with `VITE_APPLE_MERCHANT_ID` set (see `npm run cap:ios`).

**Google Pay setup**
1. In the **Stripe Dashboard**, enable Google Pay.
2. No extra key needed in the app — it uses the Stripe publishable key. Google
   reviews Google Pay for production use when you publish.

> Note: the Capacitor Stripe plugin pins an older `@stripe/stripe-js` peer than
> the web app uses, so `client/.npmrc` sets `legacy-peer-deps=true`. `react-is`
> is declared explicitly because that flag disables npm peer auto-install.

## Face ID / Touch ID login

In the native app, after a password sign-in the user is asked whether to enable
**Face ID / Touch ID**. If they accept, the Supabase refresh token is stored in
the biometric-protected keychain; on the next launch the login screen shows an
**Unlock with Face ID / Touch ID** button that restores the session. Signing out
clears the stored credential.

- **No server config or accounts needed** — it works out of the box on device.
- iOS: `NSFaceIDUsageDescription` is set in `Info.plist`.
- Android: `USE_BIOMETRIC` permission is set in the manifest.
- Web: the feature is inert (the button never appears).

## Updating the apps after a code change
```
cd client
VITE_API_URL=https://YOUR-RAILWAY-API npm run cap:sync
```
Then re-archive in Xcode / re-build the bundle in Android Studio and upload the
new version. (Web-only changes still go live instantly via Vercel for the PWA;
store apps require a new upload.)
