# 3D Spatial Object Model – Implementation Plan

## Overview
This document codifies the original implementation plan for rendering 3D objects from a declarative DSL using Three.js (via React Three Fiber).

The model is analogous to the HTML/CSS box model, but for 3D interior composition:
- **Document space**: wall/floor axis
- **Elements**: declarative cuboid/cutout objects from DSL entries
- **Box model equivalent**: cuboid model (offset + size on each axis)

---

## Goals
- Render realistic interior wall/floor scene by default.
- Compose fixtures/furniture as DSL-defined objects in shared wall space.
- Support multiple declarative entries with predictable ordering.
- Reject newer entries when collisions occur.
- Support cutout/negative space semantics.
- Provide full-screen viewer + drawer-based DSL editing UX.

---

## Coordinate System and Units

### DSL unit system
- `1 step/pace = 3 DSL units`
- `1 DSL unit = 1/3 step/pace`

### Axis model
- `x`: horizontal along wall (left to right)
- `y`: vertical from floor upward
- `z`: depth outward from wall into room

### World conversion
- Use a fixed scalar for rendering: `WORLD = DSL * UNIT_SCALE`
- Current implementation uses `UNIT_SCALE = 0.33`.

---

## DSL Specification

### Core grammar
Each entry is expressed as:

`+xOffset+xSize/+yOffset+ySize/+zOffset+zSize`

Example:

`+2+4/+0+6/+1+3`

Meaning:
- x: offset 2, size 4
- y: offset 0, size 6
- z: offset 1, size 3

### Compact fractional encoding
Because DSL numeric symbols are digit-only, compact fractions are encoded with leading zero:
- `01` => `0.1`
- `001` => `0.01`
- `05` => `0.5`
- `015` => `0.15`

Parsing rule:
- if token matches `^0\d+$`, decode as `0.<rest>`
- else parse as integer

### Style payload
Style text is CSS-like and currently supports:
- `color: ...;`
- `border: ...;` (enables edge lines)

---

## Data Model

Each accepted/rejected entry is represented by a scene object including:
- identity and raw DSL/style
- parsed axis values (`x`, `y`, `z`)
- derived visual style (`color`, `border`)
- status (`accepted` / `rejected`) and optional reason

Bounding boxes are represented as axis-aligned AABBs for collision checks.

---

## Composition, Collision, and Ordering

### Insertion flow
1. Parse DSL
2. Parse style
3. Build candidate object + candidate AABB
4. Check against existing **accepted** objects
5. If intersects: reject newest object with collision reason
6. Else: accept and render

### Collision policy
- Policy is first-come, first-kept.
- New colliding objects are omitted from rendered accepted set.

### AABB intersection
Objects intersect when overlap exists on all three axes.

---

## Cutout / Negative Space

### DSL rule
- `zOffset = 0` and `zSize = 0` designates a **cutout object**.

### Rendering strategy
- Cutout objects are excluded from positive cuboid rendering.
- Accepted cutouts are applied as **CSG subtraction** operations against the wall mesh.
- Wall is modeled as a thin box to support boolean carving.

---

## Scene and Rendering Plan

### Default interior scene
- Full-screen 3D canvas
- Floor surface
- Wall geometry (cuttable)
- Ambient + directional lighting
- Environment preset for realism
- Contact shadows
- Orbit controls with constrained movement

### Object rendering
- Non-cutout accepted entries render as cuboids
- Optional border style renders edge lines

---

## SPA Architecture

### Stack
- React + TypeScript + Vite
- `@react-three/fiber` for declarative Three.js
- `@react-three/drei` helpers
- `zustand` state store
- `@react-three/csg` for wall subtraction

### Major modules
- **Parser layer**: DSL + style decoding
- **State layer**: object list and add/remove actions
- **Layout/validation layer**: collisions and acceptance status
- **Render layer**: room, CSG wall, positive objects
- **UI layer**: drawer input + object status list

---

## UX Plan

- Full-screen visualization viewport.
- Side drawer (toggleable) for:
  - entering DSL string
  - entering style string
  - adding objects
  - viewing accepted/rejected history
  - removing entries
- Clear rejection messages for parse/collision errors.

---

## MVP Milestones

1. **M1** – Base room, camera, lights, controls
2. **M2** – Single DSL object parse + render
3. **M3** – Multi-object composition + collision rejection
4. **M4** – Drawer UI and object status history
5. **M5** – Cutout handling semantics
6. **M6** – Persistence (save/load scene document) *(planned next)*

---

## Non-Goals (Current Scope)

- Physics simulation
- Material library/editor
- Complex snapping constraints
- Multi-wall room topology and parametric architecture authoring

---

## Future Enhancements

- Save/load JSON scene documents
- Undo/redo history
- Grid snapping and rulers in DSL units
- Rich style schema (roughness/metalness/textures)
- Validation overlays and axis guides
- Performance optimizations (memoized geometry, batching)



## Material style schema (PBR)

Supported style keys now include:
- `color: <css-color>;`
- `roughness: <0..1>;` (defaults to `0.6`, clamped)
- `metalness: <0..1>;` (defaults to `0.05`, clamped)
- `map: <texture-url>;`
- `normalMap: <texture-url>;`
- `roughnessMap: <texture-url>;`
- `metalnessMap: <texture-url>;`

Notes:
- Texture URLs should start with `/` or `http(s)://`.
- In Vite, place local assets under `public/` and reference them as absolute paths, e.g. `/textures/wood/albedo.jpg`.
- Scalar roughness/metalness remain active as multipliers even when maps are supplied.

Examples:
- Matte paint: `color: #8f6f6f; roughness: 0.9; metalness: 0.0;`
- Brushed metal: `color: #b8c0c8; roughness: 0.2; metalness: 1.0;`
- Textured wood: `map: /textures/wood/albedo.jpg; normalMap: /textures/wood/normal.jpg; roughnessMap: /textures/wood/roughness.jpg;`
