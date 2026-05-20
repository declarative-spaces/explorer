import { NextResponse } from "next/server";
import { compileScene, parseInputSchema } from "@/app/lib/dsl";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = parseInputSchema.parse(body);
    const result = compileScene(parsed.entries);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
