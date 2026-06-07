# Data Safety (Google Play) & App Privacy (Apple)

Answers below reflect what the SHEEN app **actually** collects. Keep them in sync
with https://sheencafe.ae/privacy. If you add analytics/ads later, update both.

Summary of what the app handles:
- **Account:** name, email, phone (Supabase Auth) — to run your account & orders
- **Location:** home address + coordinates — **only if you enter them** for delivery
- **Vehicle plate:** optional, for drive-through identification
- **Order/loyalty history:** items, dates, amounts, visit stamps
- **Payments:** processed by **Stripe**; the app never sees or stores card numbers
- **Camera:** QR scanning only — processed on device, **not stored or sent**
- **Push token:** device identifier to deliver notifications
- **Biometrics:** Face ID/Touch ID login is stored **only in the device keychain** — never collected by us

Not collected: advertising IDs, third-party trackers, contacts, photos library,
microphone, health, browsing history.

---

## Apple — App Privacy (App Store Connect → App Privacy)

**Data used to track you:** None.

**Data linked to you** (collected + tied to identity):
| Apple data type | Purpose |
|---|---|
| Name | App Functionality |
| Email Address | App Functionality |
| Phone Number | App Functionality |
| Coarse/Precise Location | App Functionality (delivery) — only if user provides |
| Purchase History | App Functionality (orders & loyalty) |
| Other User Content (vehicle plate) | App Functionality |
| Device ID (push token) | App Functionality (notifications) |

**Data not linked to you:** None.

Notes for specific items:
- **Payments:** card data is collected by Stripe under Stripe's own privacy policy; you do not declare card numbers because your app never receives them.
- **Camera:** not a "data type" to declare — it isn't collected/stored; just ensure `NSCameraUsageDescription` is set (it is).
- **Face ID:** `NSFaceIDUsageDescription` is set; biometric data never leaves the device, so nothing to declare.

---

## Google — Data Safety form (Play Console → App content → Data safety)

**Does your app collect or share user data?** Yes (collect). **Share:** No (Stripe
is a processor, not data sharing for the form's purposes — but follow the latest
Play guidance; payment processors are generally a processor relationship).

**Is all data encrypted in transit?** Yes (TLS).
**Can users request data deletion?** Yes — in-app "Delete My Account" + via sheencafe.ae.

Data types to declare as **Collected** (linked to user, purpose = App functionality):
| Category | Type |
|---|---|
| Personal info | Name, Email address, Phone number |
| Location | Approximate + precise location (only if provided, for delivery) |
| Financial info | Purchase history. (Payment info handled by Stripe — declare per Stripe/Play guidance) |
| App activity | Order history / in-app actions |
| Device or other IDs | Device ID (push token) |

Security practices:
- [x] Data encrypted in transit
- [x] Users can request deletion
- [x] Committed to Play Families Policy: N/A (not child-directed)

Do **not** declare: Photos/Camera content (not stored), Contacts, Messages,
Health, Calendar, Biometric data (kept on device only).

---

## Account deletion (both stores now require an in-app path)
The app already provides **Delete My Account** in the profile screen, which removes
personal data and anonymises order records. Link for Apple's "Account Deletion"
field and Play's Data safety: https://sheencafe.ae (profile → delete account).
