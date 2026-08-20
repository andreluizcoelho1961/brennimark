import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptApiKey, last4 } from "@/lib/ai/crypto";
import { PROVIDERS, type AIProvider, type AIRole } from "@/lib/ai/provider";
import { getCurrentWorkspaceId, listSettings } from "@/lib/ai/settings";

const VALID_PROVIDERS = new Set(PROVIDERS.map((p) => p.value));
const VALID_ROLES = new Set<AIRole>(["chat", "analysis", "both"]);

export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return NextResponse.json({ settings: [] });

  const settings = await listSettings(workspaceId);
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const provider = body?.provider as AIProvider | undefined;
  const model = body?.model as string | undefined;
  const apiKey = body?.apiKey as string | undefined;
  const role = body?.role as AIRole | undefined;

  if (!provider || !VALID_PROVIDERS.has(provider) || !model || !apiKey || !role || !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { ciphertext, iv } = encryptApiKey(apiKey);

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_settings")
    .insert({
      workspace_id: workspaceId,
      provider,
      model,
      role,
      api_key_ciphertext: ciphertext,
      api_key_iv: iv,
      api_key_last4: last4(apiKey),
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 500 });
  }

  const settings = await listSettings(workspaceId);
  return NextResponse.json({ settings }, { status: 201 });
}
