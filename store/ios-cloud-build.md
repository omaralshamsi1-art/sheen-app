# Build & publish iOS from Windows (no Mac) — Codemagic

The `codemagic.yaml` at the repo root builds the SHEEN iOS app on a cloud Mac and
uploads it to App Store Connect / TestFlight. You do everything from a browser.

## One-time setup

### 1. Create the app record in App Store Connect
- appstoreconnect.apple.com → **My Apps → +** → New App
- Platform iOS, Name "SHEEN — Speciality Coffee", Bundle ID **`ae.sheencafe.app`**
  (register the Bundle ID first under developer.apple.com → Identifiers if needed),
  SKU e.g. `sheen-app`, primary language English.

### 2. Create an App Store Connect API key
- App Store Connect → **Users and Access → Integrations → App Store Connect API**
- Generate a key with **Admin** (or App Manager) role.
- Download the `.p8` file and note the **Key ID** and **Issuer ID**.

### 3. Set up Codemagic
- Sign up at **codemagic.io** with GitHub, give it access to this repo.
- **Teams → Integrations → App Store Connect** → add the key from step 2,
  name it exactly **`SHEEN ASC Key`** (matches `codemagic.yaml`).
- **Environment variables** → create a group named **`sheen`** with:
  - `VITE_API_URL` = your Railway API URL (e.g. `https://xxxx.up.railway.app`)
- Apple Developer → **Certificates/Identifiers**: make sure the Bundle ID
  `ae.sheencafe.app` exists (Codemagic can manage signing automatically via the
  API key, creating provisioning profiles for you).

### 4. Run the build
- In Codemagic, pick the **ios-capacitor** workflow → **Start new build** on the
  `feat/capacitor-native-apps` branch (or after merge, `main`).
- It installs deps, builds the web app with your API URL, syncs Capacitor,
  signs, and uploads to **TestFlight**.

## Going live
1. First build lands in **TestFlight** — install via the TestFlight app on an
   iPhone to check it (no Mac needed).
2. When happy, either flip `submit_to_app_store: true` in `codemagic.yaml`, or in
   App Store Connect attach the build to the app version, fill the listing
   (store/app-store-listing.md), App Privacy (store/data-safety-and-privacy.md),
   add screenshots, and **Submit for Review**.

> Apple has **no** "12 testers" rule — TestFlight is optional. You can submit to
> review straight away once a build is uploaded.

## Notes
- iОS build minutes: Codemagic's free tier (~500 min/month, M-class macs) is plenty.
- If a build fails, send me the Codemagic log — the config may need a small tweak
  (Xcode version, scheme name) that's easy to adjust in `codemagic.yaml`.
