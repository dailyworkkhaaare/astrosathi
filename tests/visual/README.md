# Visual regression foundation

Action 2.4 establishes a compact pre-redesign anchor matrix. Pixel snapshots live here, separate from calculation parity, frontend contracts and route smoke tests.

## Blocking anchor matrix

| Anchor         |    Viewport | Theme         | Locale  | State                                           |
| -------------- | ----------: | ------------- | ------- | ----------------------------------------------- |
| Landing        |   320 × 800 | Dawn/light    | English | Signed out                                      |
| Language       |   390 × 844 | Dawn/light    | Marathi | Signed out                                      |
| Authentication | 1440 × 1100 | Midnight/dark | Hindi   | Signed out                                      |
| Chart          | 1440 × 1100 | Dawn/light    | English | Authenticated, provider unavailable             |
| Today          |   390 × 844 | Midnight/dark | Marathi | Authenticated, deterministic partial/error data |
| Chat           |   320 × 800 | Midnight/dark | Hindi   | Authenticated, empty conversation               |
| People         |   390 × 844 | Dawn/light    | English | Authenticated, one synthetic partner            |
| Compatibility  | 1440 × 1100 | Midnight/dark | Hindi   | Authenticated, populated synthetic result       |
| Journey        | 1440 × 1100 | Dawn/light    | Marathi | Authenticated, empty timeline                   |
| Settings       |   320 × 800 | Midnight/dark | English | Authenticated                                   |

This covers the required 320px compact validation width, a common mobile viewport and the established 1440px desktop baseline. It also exercises every supported locale and both current themes without multiplying every route across every combination.

## Stability controls

- Google Chrome is fixed through Playwright's `chrome` channel.
- Time is frozen at 8 September 2026, 12:00 IST.
- Reduced motion is requested and screenshot animations are disabled.
- Carets are hidden and screenshots use CSS-pixel scale.
- Supabase is intercepted with deterministic synthetic responses.
- Screenshots capture exactly the declared viewport, not variable page height.
- Pixel tolerance is limited to 0.5% for minor rasterization variance.

## Commands

Compare against the committed baseline:

```sh
npm run test:visual
```

Regenerate snapshots only after an explicitly approved visual change:

```sh
npm run test:visual:update
```

Never update snapshots merely to silence a failure. Review the rendered difference first and keep calculation assertions in their existing contract/parity suites.

This is the foundation, not the eventual exhaustive matrix. Each later screen action should add the relevant loading, empty, populated, partial, error and interaction-state snapshots before that screen is accepted.

The generated pre-redesign result is recorded in [BASELINE.md](./BASELINE.md).
