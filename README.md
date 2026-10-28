# JointGlow Clinical

A consultation app for aesthetics clinics: it captures a client's face with the iPhone front camera,
identifies skin and facial concerns, and simulates the visual impact of treatments so a practitioner can
build and share a treatment plan. The flow is modelled on the consultation tools in platforms such as Zenoti.

Everything runs on the device in the browser. No photos or client data leave the phone.

## What it does

1. **Client intake** – name, contact, Fitzpatrick skin type, concerns, medical history, consent checkboxes and a finger signature.
2. **Guided capture** – live front-camera view with a face-mesh overlay. The app checks distance, centring, head pose (yaw / pitch / roll), neutral expression and lighting, then auto-captures with a countdown (or tap the shutter). You can also upload an existing photo.
3. **Analysis** – 15 concern scores (0–100) with heatmap overlays:
   - lines: forehead lines, frown (glabellar) lines, crow's feet, lip lines
   - skin: under-eye circles, pigmentation & spots, redness, texture & pores, shine
   - volume: nasolabial folds, marionette lines, lip volume, midface volume
   - structure: jawline definition, facial asymmetry
   - plus an overall skin score and skin tone (ITA angle)
4. **Treatment simulator** – before/after slider with per-treatment intensity and zone controls:
   anti-wrinkle injections, lip / cheek / chin & jawline / nasolabial filler, tear trough, chemical peel,
   laser resurfacing or RF microneedling, IPL / vascular laser, Hydrafacial & skin boosters, skin tightening.
   Suggested treatments are derived from the scores.
5. **Plan** – before/after, selected treatments with editable prices and total, practitioner notes,
   a shareable summary image, and the consultation saved to the client's history.
6. **Settings** – clinic name, practitioner, currency, treatment menu and prices, disclaimer, auto-capture.

## How it works

- **Face geometry**: [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
  (478 landmarks, blendshapes and head pose) running in WebAssembly. The runtime and model are bundled with the app,
  so it works offline once installed.
- **Analysis** (`src/lib/analysis.ts`): classical image analysis on landmark-defined regions. Fine lines are measured
  as dark fine structures (frequency separation), pigmentation as mid-scale dark blobs, redness from CIELAB a*,
  under-eye darkness relative to the cheeks, lip and jaw metrics from landmark geometry. The raw-metric-to-score
  mappings live in the `CAL` table and are meant to be tuned on your own clinic photos.
- **Simulation** (`src/lib/gl/`): a WebGL renderer draws the photo through a shader that smooths lines, lifts
  fold shadows, evens tone, reduces redness and adds glow inside soft zone masks; filler treatments displace the
  face mesh (lips, cheeks, chin, jawline) with smooth fall-off while the background stays fixed.
- **Storage**: IndexedDB on the device (clients, consultations with photos, settings).

The scores and simulations are visual consultation aids, not a diagnosis, and the disclaimer is shown on every summary.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173 (camera works on localhost)
npm run build      # production build in dist/
npm run preview    # serve the production build
```

Node 20.19+ or 22.12+ is required. `npm run dev`/`build` copy the MediaPipe WASM runtime from
`node_modules` into `public/wasm` automatically.

### On an iPhone

iOS Safari only exposes the camera on **HTTPS** (or `localhost`), so the app has to be served over HTTPS:

1. **GitHub Pages (recommended)** – the workflow in `.github/workflows/deploy-pages.yml` builds and deploys on every
   push to `main`. In the repository go to *Settings → Pages* and set *Source* to **GitHub Actions**. The app will be at
   `https://<your-user>.github.io/JointGlowClinicalAPP/`.
2. Open that URL in Safari on the iPhone, allow camera access, then use *Share → Add to Home Screen*. It opens
   full-screen like a native app and keeps working offline.
3. For local testing on a phone, use any HTTPS tunnel (for example `npx localtunnel --port 5173`) pointed at `npm run dev`.

Tips for good captures: even front lighting, no glasses, hair off the forehead, neutral expression, phone at eye level.

## Tests

`npm run test:e2e` runs a Playwright smoke test against `dist/` in headless Chromium with a fake camera feed. It
checks that a face is detected live, a capture is analysed, the untreated simulation matches the photo, enabling
treatments changes the render only locally, and a consultation can be saved and reopened.

```bash
# make a fake camera clip from any portrait photo (requires ffmpeg), then run:
ffmpeg -loop 1 -i portrait.jpg -t 3 -r 15 -pix_fmt yuv420p -vf scale=720:960 camera.y4m
npm run build && node tests/e2e.mjs --video camera.y4m --photo portrait.jpg
```

Screenshots are written to `tests/output/`.

## Project layout

```
src/
  App.tsx                 navigation, app state, persistence wiring
  screens/                Home, Intake, Client, Capture, Analysis, Simulator, Plan, Settings
  components/ui.tsx       shared controls (score ring, sliders, switches, signature pad)
  lib/faceMesh.ts         MediaPipe wrapper, head pose, mesh triangulation
  lib/pose.ts             capture quality checks (framing, pose, expression, lighting)
  lib/regions.ts          landmark-based facial regions
  lib/analysis.ts         concern scoring and heatmaps
  lib/masks.ts            zone masks for the simulator shader
  lib/warps.ts            filler/tightening mesh displacements
  lib/treatments.ts       treatment catalogue and shader intensities
  lib/recommend.ts        score -> suggested treatments
  lib/gl/                 WebGL renderer and shaders
  lib/db.ts               IndexedDB storage
  lib/summary.ts          shareable summary image
public/models/            face_landmarker.task (MediaPipe, Apache-2.0)
public/wasm/              MediaPipe runtime (copied at build time, git-ignored)
tests/e2e.mjs             Playwright end-to-end smoke test
```

## Tuning for your clinic

- Prices, enabled treatments, currency and the disclaimer are in *Settings* inside the app.
- Score calibration: `CAL` in `src/lib/analysis.ts` maps raw metrics to 0–100. Run the e2e test (it prints the raw
  metrics) or inspect `window.__jgLastAnalysis` in the browser console on real client photos and adjust the ranges.
- Simulation strength: the warp amounts in `src/lib/warps.ts` and the shader weights in `src/lib/treatments.ts`.
- Recommendation thresholds: `RULES` in `src/lib/recommend.ts`.
