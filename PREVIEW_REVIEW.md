# Railway preview review

Branch: `preview/railway-refinements`
Base: `845159997320a2c5b09753a12975ce79af670e1b` (`main`, matching the inspected Vercel production deployment).

## Implemented

- Restore Tailwind 4 styling using the existing theme configuration. This corrects the missing utility styles rather than introducing a new theme.
- Close sound consent for both choices, keep audio silent before consent, respect mute on both routes, stop ambient audio on mute/unmount, and recover when browser storage is unavailable.
- Keep browser/server preference snapshots consistent to prevent hydration mismatches.
- Keep navigation aligned with the disclaimer's measured height; use compact navigation on tablets; prevent the track-plan card overflowing on phones.
- Add focus management, Escape dismissal, scroll locking, focus restoration, native gallery buttons, and labelled navigation controls.
- Make signal controls work with touch and keyboard without double toggling, and expose pressed states.
- Keep random layouts stable during rerenders; mirror SVG arcs correctly; reset train positions when changing layouts; make movement use elapsed time rather than frame count.
- Honour reduced-motion preferences; avoid a repeated geometry measurement/render cycle.
- Correct 00 gauge scale to approximately 1:76, and clearly label the astronaut model as a demo.
- Give the third-party model loader a failure message and retry control instead of an endless spinner.

## Validation

Run `npm ci`, `npm run lint`, `npm run build` and `npm run test:preview`.
The browser suite needs a running site at `http://localhost:3000`, Node 22.18+ (native TypeScript loading), and Chromium. It uses `/usr/bin/chromium` when present; otherwise install the Playwright browser with `npx playwright install chromium`. `CHROMIUM_PATH` can select another installation.
Nine browser/geometry checks passed. The interaction suite blocks external asset requests for deterministic offline testing; separate screenshots use actual assets. Lint and TypeScript checks passed.

Audio checks instrument play calls to verify mute behaviour; they do not assess subjective sound quality. Both routes are checked for hydration errors and mobile overflow. Production build, keyboard gallery, touch signal, stored mute, blocked storage, banner offset, arc mirroring, and model retry checks are included.

## Larger proposal — not implemented

Retain the dark-and-gold palette, typography, content order, and train scene. Replace the current Layout/Random switch with a compact, collapsible control panel containing Run/Pause, speed, sound, and Layout/Random. Give signals explicit Stop/Proceed status and consistent keyboard control. This would add functionality without rebuilding the page.

A separate later pass could replace stock images and the astronaut demo with genuine railway photos/models and distinguish planned journal entries from completed work. The heritage descriptions still need a source-based factual review.

## Publishing

No changes have been pushed or deployed. `main`, production aliases, and Cloudflare DNS remain unchanged. The connected GitHub account has read-only access to `benjaminjob1/bens-model-railway`; the environment has no Vercel write credentials.

Once access is enabled, push only `preview/railway-refinements` and create a preview deployment. Do not use `--prod`, promote a deployment, merge to `main`, or change DNS for this review.
