# CipherStack Deployment Notes (Vercel)

## Current Project Type
This repository is a static vanilla JavaScript app (no build step):
- `index.html`
- `ciphers.js`
- `pipeline.js`
- `PipelineFlow3D.jsx`

It is **not** a Next.js/Vite/CRA app right now, so commands like `npm run dev` fail unless a `package.json` and scripts are added.

## What Was Causing Confusion
- `npm run dev` returns an error because there is no `package.json` script setup in this static repo.
- Extra local folders/files (for skills/temp data) can be uploaded to Vercel unnecessarily and make troubleshooting harder.

## Fixes Applied
1. Added `vercel.json` for static deployment routing:
- Serve real files first (`handle: filesystem`)
- Fallback to `index.html` for SPA-style routes

2. Added `.vercelignore` to exclude non-app files from deployment:
- `.git`
- `.sixth`
- `.tmp_spline_skill`
- `spline-3d-integration-skill (1).zip`

## Recommended Vercel Settings
In Vercel project settings:
1. Framework Preset: `Other`
2. Build Command: leave empty
3. Output Directory: leave empty
4. Install Command: leave empty

## Local Run (No Node Required)
Use any static server:
1. VS Code Live Server
2. Python static server:
   - `python -m http.server 5500`
3. Then open:
   - `http://localhost:5500/`

## Quick Troubleshooting
1. Blank page on Vercel:
- Open browser DevTools console
- Check network tab for missing files (`ciphers.js`, `pipeline.js`, `PipelineFlow3D.jsx`)
- Confirm Vercel is not forcing a Node/framework build

2. 3D scene not loading:
- Confirm internet access to `esm.sh` and Spline CDN URLs
- Check if ad/script blockers are blocking external modules

3. Works local, fails on Vercel:
- Verify case-sensitive file names in imports
- Redeploy after clearing old cache in Vercel

## Notes About TSX Components Added Earlier
This repo now contains optional TSX component files under:
- `components/ui`
- `components/blocks`
- `lib`

They are not required for the current static deployment and are not imported by `index.html`.

## Current Status
- `index.html` has no editor errors
- Hero testimonials are integrated in the live static app
- Vercel deployment behavior is now documented and hardened for static hosting
