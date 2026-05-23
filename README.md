# Atlas Space Viewer (Next.js)

A mobile-first web app for composing a wall-space scene with a compact DSL and rendering a fixed 9:16 camera slice.

## Requirements

- Node.js 18+ (recommended: 20+)
- npm

## Install

```bash
npm install
```

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

## Current rendering backend

The app currently returns a placeholder SVG image from the API while preserving the full parse/collision/clip/prompt pipeline. Wire `/api/scene/render` to OpenAI Images API to produce photorealistic output.
