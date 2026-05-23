import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

const VIEWPORT_WIDTH = 9;
const VIEWPORT_HEIGHT = 16;

function parseDslNumber(raw) {
  if (!/^\d+$/.test(raw)) throw new Error(`Invalid numeric token: ${raw}`);
  if (raw.length === 1) return Number(raw);
  if (raw.startsWith('0')) return Number(`0.${raw.slice(1)}`);
  return Number(raw);
}

function parseDslLine(line, idx) {
  const [spec, description] = line;
  const parts = spec.split('/');
  if (parts.length !== 3) throw new Error(`Invalid DSL shape at index ${idx}`);

  const parsePair = (segment) => {
    const m = segment.match(/^\+(\d+)\+(\d+)$/);
    if (!m) throw new Error(`Invalid segment: ${segment}`);
    return [parseDslNumber(m[1]), parseDslNumber(m[2])];
  };

  const [x, width] = parsePair(parts[0]);
  const [y, height] = parsePair(parts[1]);
  const [z, depth] = parsePair(parts[2]);

  return {
    id: `obj_${idx + 1}`,
    x,
    width,
    y,
    height,
    z,
    depth,
    description,
    createdAt: idx
  };
}

function overlap1D(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1;
}

function collides(a, b) {
  return overlap1D(a.x, a.x + a.width, b.x, b.x + b.width)
    && overlap1D(a.y, a.y + a.height, b.y, b.y + b.height)
    && overlap1D(a.z, a.z + Math.max(a.depth, 0.0001), b.z, b.z + Math.max(b.depth, 0.0001));
}

function resolveCollisions(objects) {
  const accepted = [];
  const rejected = [];
  for (const obj of [...objects].sort((a, b) => a.createdAt - b.createdAt)) {
    if (accepted.some((existing) => collides(existing, obj))) {
      rejected.push(obj);
      continue;
    }
    accepted.push(obj);
  }
  return { accepted, rejected };
}

function clipToViewport(object, cameraX) {
  const viewportLeft = cameraX;
  const viewportRight = cameraX + VIEWPORT_WIDTH;
  const objLeft = object.x;
  const objRight = object.x + object.width;
  if (!overlap1D(objLeft, objRight, viewportLeft, viewportRight)) return null;

  const visibleXStart = Math.max(objLeft, viewportLeft);
  const visibleXEnd = Math.min(objRight, viewportRight);

  return {
    ...object,
    clipped: {
      visibleXStart,
      visibleXEnd,
      visibleWidth: visibleXEnd - visibleXStart,
      screenX: visibleXStart - viewportLeft
    }
  };
}

function compilePrompt(visibleObjects, cameraX) {
  const sceneHeader = [
    'Photorealistic interior wall section.',
    `Vertical 9:16 framing. Viewport width is exactly ${VIEWPORT_WIDTH} units and height exactly ${VIEWPORT_HEIGHT} units.`,
    `Current camera slice starts at world x=${cameraX} and shows x=[${cameraX}, ${cameraX + VIEWPORT_WIDTH}].`,
    'Subtle realistic perspective, including top and bottom convergence lines, while keeping vertical lines straight.',
    'Show only listed objects. No extra furniture or decor.'
  ].join(' ');

  const lines = visibleObjects.map((o, i) => (
    `${i + 1}. ${o.description}; world: x=${o.x},y=${o.y},z=${o.z},w=${o.width},h=${o.height},d=${o.depth}; `
    + `visible: screenX=${o.clipped.screenX}, visibleWidth=${o.clipped.visibleWidth}, y=${o.y}, height=${o.height}, zOffset=${o.z}, depth=${o.depth}.`
  ));

  return `${sceneHeader}\nObjects:\n${lines.join('\n')}`;
}

app.post('/api/scene/parse', (req, res) => {
  try {
    const entries = req.body?.entries;
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be an array' });
    const objects = entries.map(parseDslLine);
    const { accepted, rejected } = resolveCollisions(objects);
    res.json({ viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }, accepted, rejected });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/scene/render', (req, res) => {
  try {
    const entries = req.body?.entries;
    const cameraX = Number(req.body?.cameraX ?? 0);
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be an array' });
    if (Number.isNaN(cameraX)) return res.status(400).json({ error: 'cameraX must be a number' });

    const objects = entries.map(parseDslLine);
    const { accepted, rejected } = resolveCollisions(objects);
    const visible = accepted.map((o) => clipToViewport(o, cameraX)).filter(Boolean);
    const prompt = compilePrompt(visible, cameraX);

    // Placeholder image endpoint - wire OpenAI Images API in production using OPENAI_API_KEY.
    const image = {
      kind: 'placeholder',
      url: `/placeholder.svg?cameraX=${encodeURIComponent(cameraX)}`
    };

    res.json({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT, cameraX },
      visible,
      rejected,
      prompt,
      image
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/placeholder.svg', (req, res) => {
  const cameraX = Number(req.query.cameraX ?? 0);
  res.type('image/svg+xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1600" width="900" height="1600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#dedede"/>
      <stop offset="100%" stop-color="#b8b8b8"/>
    </linearGradient>
  </defs>
  <rect width="900" height="1600" fill="url(#g)"/>
  <line x1="0" y1="0" x2="900" y2="220" stroke="#8a8a8a" stroke-width="4"/>
  <line x1="0" y1="1600" x2="900" y2="1380" stroke="#8a8a8a" stroke-width="4"/>
  <text x="30" y="80" font-size="42" fill="#222" font-family="Arial">9:16 Slice Placeholder</text>
  <text x="30" y="130" font-size="32" fill="#222" font-family="Arial">cameraX=${cameraX}</text>
</svg>`);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
