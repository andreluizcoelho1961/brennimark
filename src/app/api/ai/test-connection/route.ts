import { NextResponse } from "next/server";
import { generateText } from "ai";
import { getModel, PROVIDERS, type AIProvider } from "@/lib/ai/provider";
import { classifyAIError } from "@/lib/ai/errors";

const VALID_PROVIDERS = new Set(PROVIDERS.map((p) => p.value));

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const provider = body?.provider as AIProvider | undefined;
  const model = body?.model as string | undefined;
  const apiKey = body?.apiKey as string | undefined;

  if (!provider || !VALID_PROVIDERS.has(provider) || !model || !apiKey) {
    return NextResponse.json({ ok: false, code: "invalid_input", message: "Preencha provedor, modelo e chave." }, { status: 400 });
  }

  try {
    await generateText({
      model: getModel({ provider, model, apiKey }),
      prompt: "Reply with exactly one word: ok",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { code, message } = classifyAIError(error);
    return NextResponse.json({ ok: false, code, message }, { status: 200 });
  }
}
