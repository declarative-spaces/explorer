# atlas

MVP CSR SPA for a Spatial Object Model viewer.

## Run locally

Use any static server from this directory, for example:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## MVP features

- Three.js wall-space rendering with orthographic 9x16 viewport slice
- DSL parsing for `"+x+w/+y+h/+z+d" : "style"` lines
- Compact numeric parsing (`01 => 0.1`, `001 => 0.01`)
- Composition of multiple objects
- Collision handling (newer overlapping objects omitted)
- Mobile-style fullscreen canvas with bottom drawer DSL editor
- Horizontal pan scrolling across larger wall space
