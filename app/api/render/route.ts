import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildPrompt, parseInputSchema, compileScene } from "@/app/lib/dsl";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = parseInputSchema.parse(body);
    const scene = compileScene(parsed.entries);
    const prompt = buildPrompt(scene.objects);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured on server." }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });
    const image = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1792"
    });

    return NextResponse.json({
      prompt,
      warnings: [...scene.warnings, ...scene.objects.flatMap((o) => o.warnings)],
      imageBase64: image.data?.[0]?.b64_json ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
