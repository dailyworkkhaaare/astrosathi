# Store Readiness Checklist

AstroSaathi is not fully native-packaged yet, so this checklist separates what
is enforced in the web app today from what must be verified after the
Capacitor iOS/Android shell exists.

## Automated Now

- Mobile wrapper viewport gate:
  - 360 x 780, English, light, Today
  - 390 x 844, Hindi, dark, Ask
  - 430 x 932, Marathi, light, People
- No horizontal page overflow on the checked phone classes.
- Bottom world navigation remains visible and viewport-width on mobile.
- Reduced-motion mode is used during the screenshot gate.
- Offline mode shows a compact native-style network banner without replacing
  the current screen.
- Manifest install metadata is present:
  - `display: standalone`
  - `orientation: portrait`
  - matching background/theme colors
  - maskable 192 and 512 icons
- Launch metadata is present:
  - `viewport-fit=cover`
  - `apple-mobile-web-app-capable=yes`
  - Apple touch icon
- App icon dimensions are checked:
  - `apple-touch-icon.png`: 180 x 180
  - `pwa-192x192.png`: 192 x 192
  - `pwa-512x512.png`: 512 x 512

Run:

```bash
npx playwright test tests/e2e/store-readiness.spec.ts --project=mobile-chrome
```

## Manual After Capacitor Wrap

- iPhone SE class screenshots, light and dark.
- iPhone 15/16 class screenshots, light and dark.
- Pixel compact and Pixel large screenshots.
- English, Hindi, and Marathi screenshots for store listings.
- iOS status bar color on:
  - Today
  - Ask
  - onboarding/auth
  - Settings
- Android navigation bar color and contrast.
- App launch splash timing and logo framing.
- Real-device keyboard behavior for:
  - auth email/password
  - Ask composer
  - add person
  - add life event
  - settings forms
- Native share sheet on iOS and Android.
- App resume from background after at least 10 minutes.
- Offline-to-online recovery after sending or refreshing guidance.
- Notification permission education once native notifications are wired.
