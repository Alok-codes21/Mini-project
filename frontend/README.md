# MathVision frontend (upgraded)

Same pages and design as before, plus React, Motion, Motion Primitives-style components and a React Bits-style hero.

## Run
```
npm install
npm run dev        # http://localhost:5173
npm run build      # output in dist/
```
Needs Node 18+.

## Where things are
- `src/api.js`          THE ONLY file that talks to maths results. Replace each function body with the backend call. Includes `askAI()` hook for the AI helper panel.
- `src/demo-engine.js`  TEMPORARY placeholder logic so the animations have data. Delete it when the backend is connected.
- `src/pages/*`         per-page behaviour (matrix, converter, sets, relation, practice, history, about, home)
- `src/lib/fx.js`       shared animations (word reveal, tabs, step player, hover/press)
- `src/lib/ai-panel.js` AI helper panel (UI only)
- `src/react/HeroCard.jsx` React hero card on the home page
- `src/enhance.css`     all new styles (uses the existing theme variables, light and dark)
- `public/script.js`, `public/matrix.js` original scripts (theme toggle, popups, matrix grid) kept as they were

Backend response shape expected by the UI: `{ result, steps: [{ title, text, visual }] }` or `{ error }`. See comments in `src/api.js` and `src/demo-engine.js`.

Chart.js is not used.
- `src/lib/extras.js` extra interactions: scroll bar, back-to-top, click ripple, magnetic buttons, page fade-out, floating math symbols, stats strip, "Try an example" chips

## Connecting the backend (Matrix + Number Converter)
1. Start the backend (Mini-project): `npm ci && npm start` (http://localhost:3000). Allow this site: `CORS_ORIGIN=http://localhost:5173 npm start` (or leave it empty in development).
2. Run `npm run dev`. Matrix (add, subtract, multiply, transpose, determinant) and the Converter always use the backend through same-origin /api. Set VITE_API_URL only for a separate API host.
3. `src/backend-adapter.js` translates the formats (numbers, base names, steps, errors). Inverse is shown as "coming soon" because the backend has no route yet. Sets, Relations, Practice and AI stay on the demo engine until those modules exist.
4. For a deployed site, set the backend's `CORS_ORIGIN` to the exact site origin (no trailing slash) and `TRUST_PROXY=1` behind Render.

## v4 UI pack (items 1-22)
- src/ui22.css + src/lib/ui22.js: breadcrumbs, size stepper (1-6), pill tabs/buttons, preset selects, search (page jump + history filter), border-trail textareas, card sliding pill, show more, auto theme (follows device), top blur, logo ring.
- src/lib/ascii-field.js: original WebGL2 reimplementation of a cursor-reactive glyph field in the style of the motion.dev/examples hero (blue ground, colours flow green > cyan > purple). No motion.dev code copied.
- src/react/AIHeroCard.jsx: UI-only chat card; calls askAI() in src/api.js.
- Backend URL: set VITE_API_URL. Frontend only; src/api.js stays the hook file.

## Integrated Matrix + Number System (new branch)
Both modules now always use the real backend, not demo fallback. Start the API
from the repo root (`npm ci && npm start`) and the frontend in a second terminal
(`npm --prefix frontend ci && npm --prefix frontend run dev`). Vite proxies /api
to localhost:3000. No .env is required. A separately hosted API may be selected
with VITE_API_URL; only that cross-origin setup requires CORS_ORIGIN.

Run `node scripts/build-integrated.mjs` from the repo root after installing both
packages. It rebuilds docs/ and bundles the unchanged Express backend into a
same-origin Vercel function in docs/api/index.js. The existing docs-root Vercel
project can preview this branch without changing its production branch. The
GitHub Pages static host cannot run /api, so these two modules will show a clear
backend error there rather than pretend to return real results.

Matrix: add/subtract/multiply/transpose/determinant (determinant up to 4x4).
Inverse is not implemented by the backend. Converter: signed integers in bases
2/8/10/16, including exact large integers. Sets/Relations/Practice remain demos;
AI remains unconnected. Full backend steps, formulas and key points are shown.
