import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import { decryptApiKey } from "@/lib/ai/crypto";
import type { AIProvider } from "@/lib/ai/provider";
import { ENCAIXES } from "@/lib/ia-propria/validar";
import { testarConexao } from "@/lib/ia-propria/testar";

/**
 * Configurações › IA › Testar conexão (ADR-0009).
 *
 * A dona é conferida pela sessão ANTES de o servidor tocar na chave: só quem
 * administra a conta consegue ver o encaixe (`listar_chaves_de_ia`). Depois a
 * chave é lida com a chave de serviço, decifrada na memória, usada numa chamada
 * mínima e descartada. A resposta é um CÓDIGO ("ok", "invalid_key"...) — nunca
 * a mensagem do provedor, nunca a chave.
 */
const SEM_CACHE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const corpo = (await request.json().catch(() => null)) as { encaixe?: unknown } | null;
  const encaixe = typeof corpo?.encaixe === "string" ? corpo.encaixe : "";
  if (!ENCAIXES.includes(encaixe as (typeof ENCAIXES)[number])) {
    return NextResponse.json({ error: "encaixe_invalido" }, { status: 400, headers: SEM_CACHE });
  }

  // A sessão decide quem é dona: a função confere de novo e recusa quem não é.
  const sessao = await createClient();
  const lista = await sessao.rpc("listar_chaves_de_ia", { p_workspace_id: r.workspaceId });
  if (lista.error?.hint === "ia_so_a_dona") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  if (lista.error) return NextResponse.json({ error: "nao_testou" }, { status: 500, headers: SEM_CACHE });
  if (!(lista.data as { encaixe: string }[]).some((c) => c.encaixe === encaixe)) {
    return NextResponse.json({ error: "encaixe_vazio" }, { status: 404, headers: SEM_CACHE });
  }

  const servico = createServiceClient();
  const { data, error } = await servico.rpc("chave_de_ia_para_uso", { p_workspace_id: r.workspaceId, p_encaixe: encaixe });
  const linha = (data as { provedor: string; modelo: string; chave_cifrada: string; chave_iv: string }[] | null)?.[0];
  if (error || !linha) return NextResponse.json({ error: "nao_testou" }, { status: 500, headers: SEM_CACHE });

  let apiKey: string;
  try {
    apiKey = decryptApiKey(linha.chave_cifrada, linha.chave_iv);
  } catch {
    // Chave-mestra trocada ou linha corrompida: a agência precisa cadastrar de novo.
    await servico.rpc("registrar_teste_de_chave_de_ia", { p_workspace_id: r.workspaceId, p_encaixe: encaixe, p_ok: false });
    return NextResponse.json({ ok: false, code: "chave_ilegivel" }, { headers: SEM_CACHE });
  }

  const resultado = await testarConexao({ provider: linha.provedor as AIProvider, model: linha.modelo, apiKey });
  await servico.rpc("registrar_teste_de_chave_de_ia", { p_workspace_id: r.workspaceId, p_encaixe: encaixe, p_ok: resultado.ok });
  return NextResponse.json(resultado.ok ? { ok: true } : { ok: false, code: resultado.code }, { headers: SEM_CACHE });
}
