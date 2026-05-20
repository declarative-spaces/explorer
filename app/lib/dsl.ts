import { z } from "zod";

export const SCENE = {
  width: 9,
  height: 16,
  wallTop: 3,
  wallHeight: 10,
  floorHeight: 3,
  ceilingHeight: 3
} as const;

export const dslEntrySchema = z.object({
  coord: z.string().min(1),
  label: z.string().min(1)
});

export const parseInputSchema = z.object({
  entries: z.array(dslEntrySchema)
});

export type DslEntry = z.infer<typeof dslEntrySchema>;

export type ParsedAxis = {
  axis: "X" | "Y" | "Z";
  offset: number;
  span: number;
  raw: string;
};

export type SceneObject = {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  warnings: string[];
};

const expandShorthand = (segment: string) => segment.replace(/\+(\d+)/g, (_, n) => "+".repeat(Number(n)));

function parseAxisSegment(segment: string, axis: "X" | "Y" | "Z"): ParsedAxis {
  const normalized = expandShorthand(segment.trim());
  const idx = normalized.indexOf(axis);
  if (idx === -1) throw new Error(`Missing axis ${axis} in segment '${segment}'`);

  const left = normalized.slice(0, idx);
  const right = normalized.slice(idx + 1);

  if (!/^\+*$/.test(left) || !/^\+*$/.test(right)) {
    throw new Error(`Invalid symbols in segment '${segment}'. Only '+' and axis marker are supported.`);
  }

  return {
    axis,
    offset: left.length,
    span: Math.max(right.length, 1),
    raw: segment
  };
}

export function parseCoord(coord: string) {
  const [sx, sy, sz] = coord.split("/");
  if (!sx || !sy || !sz) throw new Error("Coordinate must have 3 segments split by '/': X/Y/Z");
  return {
    x: parseAxisSegment(sx, "X"),
    y: parseAxisSegment(sy, "Y"),
    z: parseAxisSegment(sz, "Z")
  };
}

function checkBounds(o: SceneObject) {
  const warnings: string[] = [];
  if (o.x + o.width > SCENE.width) warnings.push(`Object exceeds scene width (${SCENE.width} units).`);
  if (o.y + o.height > SCENE.height) warnings.push(`Object exceeds scene height (${SCENE.height} units).`);
  if (o.z + o.depth > SCENE.width) warnings.push("Depth exceeds recommended range and may look distorted.");
  return warnings;
}

function checkCollisions(objects: SceneObject[]): string[] {
  const warnings: string[] = [];
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];
      const b = objects[j];
      const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
      const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
      const overlapZ = a.z < b.z + b.depth && a.z + a.depth > b.z;
      if (overlapX && overlapY && overlapZ) {
        warnings.push(`Collision warning: '${a.label}' overlaps with '${b.label}'.`);
      }
    }
  }
  return warnings;
}

export function compileScene(entries: DslEntry[]) {
  const objects: SceneObject[] = entries.map((entry, index) => {
    const parsed = parseCoord(entry.coord);
    const obj: SceneObject = {
      id: `obj_${index + 1}`,
      label: entry.label,
      x: parsed.x.offset,
      y: parsed.y.offset,
      z: parsed.z.offset,
      width: parsed.x.span,
      height: parsed.y.span,
      depth: parsed.z.span,
      warnings: []
    };
    obj.warnings = checkBounds(obj);
    return obj;
  });

  const collisionWarnings = checkCollisions(objects);
  return { objects, warnings: collisionWarnings };
}

export function buildPrompt(objects: SceneObject[]) {
  const base = `Photorealistic interior wall section, portrait 9:16 close-up, single straight-on wall only.\n` +
    `Canvas units: width 9, height 16. Ceiling band top 3 units, wall center 10 units, floor band bottom 3 units.\n` +
    `No extra side walls, no panoramic room shot, no fisheye, no people unless explicitly requested.`;

  if (!objects.length) {
    return `${base}\nRender an empty blank wall section with realistic material detail and natural lighting.`;
  }

  const objectLines = objects.map((o, i) =>
    `${i + 1}) ${o.label}; position x=${o.x}, y=${o.y}, z=${o.z}; size width=${o.width}, height=${o.height}, depth=${o.depth} units.`
  );

  return `${base}\nRender these objects exactly:\n${objectLines.join("\n")}`;
}
