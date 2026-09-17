# Action 2.4 — Visual baseline result

**Captured:** 8 September 2026  
**Comparison result:** PASS — 10/10 snapshots  
**Comparison duration:** 1.1 minutes  
**Browser:** Installed Google Chrome through Playwright's `chrome` channel

The baseline was first generated with `npm run test:visual:update`, then independently compared with `npm run test:visual`. All ten images reproduced within the declared 0.5% maximum pixel-difference tolerance.

## Snapshot inventory

- [Landing — compact, English, Dawn](./__snapshots__/visual-regression.spec.ts/01-landing-compact-en-light.png)
- [Language — mobile, Marathi, Dawn](./__snapshots__/visual-regression.spec.ts/02-language-mobile-mr-light.png)
- [Authentication — desktop, Hindi, Midnight](./__snapshots__/visual-regression.spec.ts/03-auth-desktop-hi-dark.png)
- [Chart — desktop, English, Dawn](./__snapshots__/visual-regression.spec.ts/04-chart-desktop-en-light.png)
- [Today — mobile, Marathi, Midnight](./__snapshots__/visual-regression.spec.ts/05-today-mobile-mr-dark.png)
- [Chat — compact, Hindi, Midnight](./__snapshots__/visual-regression.spec.ts/06-chat-compact-hi-dark.png)
- [People — mobile, English, Dawn](./__snapshots__/visual-regression.spec.ts/07-people-mobile-en-light.png)
- [Compatibility — desktop, Hindi, Midnight](./__snapshots__/visual-regression.spec.ts/08-compatibility-desktop-hi-dark.png)
- [Journey — desktop, Marathi, Dawn](./__snapshots__/visual-regression.spec.ts/09-journey-desktop-mr-light.png)
- [Settings — compact, English, Midnight](./__snapshots__/visual-regression.spec.ts/10-settings-compact-en-dark.png)

These PNGs describe the current pre-redesign UI; they are not endorsements of the current visual quality. Future approved redesign actions should produce intentional diffs, reviewed before their affected snapshots are updated.
