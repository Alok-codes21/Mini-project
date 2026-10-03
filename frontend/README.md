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
2. Copy `.env.example` to `.env` here and run `npm run dev`. With `VITE_API_URL` set, Matrix (add, subtract, multiply, transpose, determinant) and the Converter use the backend; without it the demo engine is used.
3. `src/backend-adapter.js` translates the formats (numbers, base names, steps, errors). Inverse is shown as "coming soon" because the backend has no route yet. Sets, Relations, Practice and AI stay on the demo engine until those modules exist.
4. For a deployed site, set the backend's `CORS_ORIGIN` to the exact site origin (no trailing slash) and `TRUST_PROXY=1` behind Render.
