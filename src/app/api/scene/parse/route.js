import { parseDslLine, resolveCollisions, VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from '@/lib/scene';

export async function POST(request) {
  try {
    const body = await request.json();
    const entries = body?.entries;
    if (!Array.isArray(entries)) {
      return Response.json({ error: 'entries must be an array' }, { status: 400 });
    }

    const objects = entries.map(parseDslLine);
    const { accepted, rejected } = resolveCollisions(objects);

    return Response.json({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      accepted,
      rejected
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
