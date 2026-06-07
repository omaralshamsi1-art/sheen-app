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

## Updating the apps after a code change
```
cd client
VITE_API_URL=https://YOUR-RAILWAY-API npm run cap:sync
```
Then re-archive in Xcode / re-build the bundle in Android Studio and upload the
new version. (Web-only changes still go live instantly via Vercel for the PWA;
store apps require a new upload.)
