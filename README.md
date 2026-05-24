# atlas

Spatial Object Viewer MVP implemented as a CSR SPA with **Vite + React + TypeScript + Three.js**.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL shown by Vite (typically `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## MVP features

- 9x16 orthographic viewport slice over a larger wall-space scene
- Three.js rendering of wall, floor, and DSL-defined wireframe cuboids
- DSL format: `"+x+w/+y+h/+z+d" : "style"`
- Compact numbers: `01 => 0.1`, `001 => 0.01`
- Collision handling: newer overlapping entries are omitted
- Mobile-first fullscreen UX with bottom DSL drawer
- Pointer drag panning for horizontal scrolling
