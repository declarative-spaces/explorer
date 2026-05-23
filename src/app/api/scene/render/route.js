import {
  clipToViewport,
  compilePrompt,
  parseDslLine,
  renderPlaceholderSvg,
  resolveCollisions,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH
} from '@/lib/scene';
import { generateImageWithOpenAi, hasOpenAiKey } from '@/lib/images';

export async function POST(request) {
  try {
    const body = await request.json();
    const entries = body?.entries;
    const cameraX = Number(body?.cameraX ?? 0);

    if (!Array.isArray(entries)) {
      return Response.json({ error: 'entries must be an array' }, { status: 400 });
    }
    if (Number.isNaN(cameraX)) {
      return Response.json({ error: 'cameraX must be a number' }, { status: 400 });
    }

    const objects = entries.map(parseDslLine);
    const { accepted, rejected } = resolveCollisions(objects);
    const visible = accepted.map((o) => clipToViewport(o, cameraX)).filter(Boolean);
    const prompt = compilePrompt(visible, cameraX);
    let image;
    if (hasOpenAiKey()) {
      image = await generateImageWithOpenAi(prompt);
    } else {
      const svg = renderPlaceholderSvg(cameraX);
      const svgBase64 = Buffer.from(svg).toString('base64');
      image = {
        kind: 'placeholder',
        url: `data:image/svg+xml;base64,${svgBase64}`
      };
    }

    return Response.json({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT, cameraX },
      visible,
      rejected,
      prompt,
      image
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
