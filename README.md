# Atlas Space Viewer (Next.js)

A mobile-first web app for composing a wall-space scene with a compact DSL and rendering a fixed 9:16 camera slice.

## Requirements

- Node.js 18+ (recommended: 20+)
- npm
- OpenAI API key (required for real image generation)

## Install

```bash
npm install
```

## Configure your OpenAI key

1. Copy `.env.example` to `.env.local`.
2. Set your key:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```bash
OPENAI_API_KEY=your_real_key_here
```

Notes:
- `OPENAI_API_KEY` is read **server-side** in `src/lib/images.js`.
- The key is never exposed in client-side browser code.
- If no key is configured, the app falls back to a placeholder SVG image.

## Run in development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm run build
npm run start
```

## Checks

```bash
npm run check
```


## View modes

- **Wireframe mode (default):** renders a local 3D wireframe preview with Three.js using the same DSL coordinates and camera slice rules.
- **Generated mode:** calls `/api/scene/render` and generates an image with OpenAI (or placeholder if no key).

Use the **Mode** button in the top toolbar to switch between low-fidelity (wireframe) and high-fidelity (generated) output.

## DSL input format

Each line in the drawer is:

```text
+x+width/+y+height/+z+depth | Description
```

Example:

```text
+2+4/+0+6/+1+3 | A small dark wood side table with curved legs and a couple drawers
+1+5/+7+6/+0+01 | A framed mirror
+7+6/+0+15/+0+05 | A metal door
```

## Current rendering behavior

- With `OPENAI_API_KEY`: `/api/scene/render` calls OpenAI Images (`gpt-image-1`) and returns the generated image.
- Without `OPENAI_API_KEY`: `/api/scene/render` returns a placeholder SVG while preserving parse/collision/clip/prompt pipeline.
