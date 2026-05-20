# atlas

A mobile-first interior wall-section browser that compiles a compact DSL into structured prompts for OpenAI image generation.

## Features

- Fixed scene contract: 9x16 portrait section, with ceiling/wall/floor bands (3/10/3 units).
- DSL parser supporting `+` runs and shorthand like `+3`.
- Composition of multiple objects in one scene.
- Collision handling: collisions are **allowed** and returned as warnings.
- No anchor inference by object name; placement is purely from DSL coordinates.
- Server-side OpenAI key usage via Next.js API routes.

## DSL

Coordinate format per object:

`<x-segment>/<y-segment>/<z-segment>`

Each segment contains exactly one axis marker (`X`, `Y`, or `Z`), with plus symbols before/after:

- plus count before marker = offset
- plus count after marker = span (defaults to 1 if omitted)

Examples:

- `++X+++` => x offset 2, width 3
- `Y+++` => y offset 0, height 3
- `+Z+++` => z offset 1, depth 3
- `+2X+3` => equivalent to `++X+++`

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Environment

Add server-side key:

`OPENAI_API_KEY=...`

## API Routes

- `POST /api/parse` validates and compiles entries.
- `POST /api/render` compiles entries, creates prompt, and generates image (`gpt-image-1`).
