# Native Shell Policy

AstroSaathi should feel like five native worlds inside Capacitor: Today, Cosmos, Ask, Journey, and People. Utility screens such as Settings stay outside the bottom tab bar and open from profile/account affordances.

## Safe Areas

- Root screens use `viewport-fit=cover`.
- Shared shell spacing reads from `--as-safe-top`, `--as-safe-right`, `--as-safe-bottom`, and `--as-safe-left`.
- Fixed bottom chrome owns bottom safe-area padding once.
- Full-screen custom shells, such as Ask, must reserve `var(--mobile-tabbar-h) + var(--as-safe-bottom)` when the shared bottom tab bar is visible.
- Bottom sheets use `var(--as-safe-bottom)` in their sticky action area.

## Mobile Navigation

- The bottom tab bar always exposes Today, Cosmos, Ask, Journey, and People on authenticated primary screens.
- Ask may use a custom full-screen conversation shell.
- Settings, profile, memory, preferences, and voice are account utilities, not primary tabs.
- Any secondary panel or drawer should close before route navigation or app exit.

## Capacitor Back Behavior

When native back handling is added, the order should be:

1. Close the topmost sheet, drawer, popover, or dialog.
2. Close Ask history/sidebar if it is open.
3. Navigate back in route history.
4. At a root world, ask for exit confirmation or let the platform policy decide.

## Status And Navigation Bars

- Dark immersive screens should use a dark status/nav bar.
- Dawn/light screens should use a light status/nav bar with sufficient icon contrast.
- Status/nav bar colors should be updated from the active route/theme, not component-local guesses.

## Regression Matrix

Before a native release candidate, check:

- 360 x 780 compact Android
- 390 x 844 compact iPhone
- 430 x 932 large iPhone/Android
- Light and dark theme
- English, Hindi, and Marathi
- Keyboard open on auth, Ask, settings forms, add person, and add life event
