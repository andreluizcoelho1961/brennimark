import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptApiKey, last4 } from "@/lib/ai/crypto";
import { PROVIDERS, type AIProvider, type AIRole } from "@/lib/ai/provider";
import { listSettings } from "@/lib/ai/settings";
import { donoDaRota } from "@/lib/brandville/contexto-da-rota";
import { modeloAutorizado } from "@/lib/ai/catalogo";

const VALID_PROVIDERS = new Set(PROVIDERS.map((p) => p.value));
const VALID_ROLES = new Set<AIRole>(["chat", "analysis", "both"]);

export async function GET(request: Request) {
  const contexto = await donoDaRota(request);
  // Lista vazia só para quem não tem sessão. Ambiguidade responde 409 e diz as
  // opções: devolver `[]` faria parecer que a conta não tem configuração
  // nenhuma, quando ela tem — na outra conta.
  if (!contexto.ok) {
    return contexto.resposta.status === 401
      ? NextResponse.json({ settings: [] })
      : contexto.resposta;
  }

  const settings = await listSettings(contexto.workspaceId);
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const contexto = await donoDaRota(request);
  if (!contexto.ok) return contexto.resposta;
  const workspaceId = contexto.workspaceId;

  const body = await request.json().catch(() => null);
  const provider = body?.provider as AIProvider | undefined;
  const model = body?.model as string | undefined;
  const apiKey = body?.apiKey as string | undefined;
  const role = body?.role as AIRole | undefined;

  if (!provider || !VALID_PROVIDERS.has(provider) || !model || !apiKey || !role || !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  /*
   * O modelo precisa estar no catálogo DAQUELE provedor.
   *
   * Antes só o provedor era validado, e qualquer string passava em `model`.
   * Ela chegava ao adaptador e daí ao provedor: no melhor caso um erro caro,
   * no pior um modelo que ninguém revisou processando o manual de um cliente.
   *
   * O par importa, e não só o nome: `anthropic/claude-sonnet-5` é um modelo do
   * OpenRouter, e `claude-sonnet-5` é da Anthropic. Aceitar o nome solto
   * deixaria configurar um com as credenciais do outro.
   */
  if (!modeloAutorizado(provider, model)) {
    return NextResponse.json({ error: "modelo_nao_catalogado" }, { status: 400 });
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
