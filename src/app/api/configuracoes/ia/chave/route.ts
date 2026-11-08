import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import { encryptApiKey } from "@/lib/ai/crypto";
import { ENCAIXES, finalDaChave, validarCadastro } from "@/lib/ia-propria/validar";

/**
 * Configurações › IA › guardar e apagar a chave de um encaixe (ADR-0009).
 *
 * A chave chega UMA vez, no corpo do pedido, é cifrada aqui com a chave-mestra
 * da Vercel e entregue ao banco por `guardar_chave_de_ia`, que confere de novo
 * dona, plano e termo. Ela NUNCA é devolvida, registrada em log ou repetida na
 * resposta: a tela só aprende "termina em ••••1234". Para mudar, cadastra-se
 * outra no mesmo encaixe, e o banco substitui.
 *
 * Nada de endereço de API: provedor e modelo vêm de uma lista fechada
 * (`validarCadastro`), e o servidor só fala com os provedores do catálogo.
 */
const SEM_CACHE = { "Cache-Control": "private, no-store" };

export async function PUT(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const corpo = await request.json().catch(() => null);
  const v = validarCadastro(corpo);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400, headers: SEM_CACHE });
  const { encaixe, provedor, modelo, chave } = v.cadastro;

  let cifra: { ciphertext: string; iv: string };
  try {
    cifra = encryptApiKey(chave);
  } catch {
    // A chave-mestra falta ou está errada no servidor: problema nosso, dito sem detalhe.
    return NextResponse.json({ error: "servidor_sem_cofre" }, { status: 503, headers: SEM_CACHE });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_chave_de_ia", {
    p_workspace_id: r.workspaceId, p_encaixe: encaixe, p_provedor: provedor, p_modelo: modelo,
    p_chave_cifrada: cifra.ciphertext, p_chave_iv: cifra.iv, p_chave_final: finalDaChave(chave), p_versao_da_chave_mestra: 1,
  });
  if (error?.hint === "ia_so_a_dona") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  if (error?.hint === "ia_sem_termo_aceito") return NextResponse.json({ error: "termo_pendente" }, { status: 409, headers: SEM_CACHE });
  if (error?.hint === "ia_conta_no_modo_da_plataforma") return NextResponse.json({ error: "modo_da_plataforma" }, { status: 409, headers: SEM_CACHE });
  if (error) return NextResponse.json({ error: "nao_guardou" }, { status: 500, headers: SEM_CACHE });
  return NextResponse.json({ ok: true, encaixe, provedor, modelo, chaveFinal: finalDaChave(chave) }, { headers: SEM_CACHE });
}

export async function DELETE(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const encaixe = new URL(request.url).searchParams.get("encaixe") ?? "";
  if (!ENCAIXES.includes(encaixe as (typeof ENCAIXES)[number])) {
    return NextResponse.json({ error: "encaixe_invalido" }, { status: 400, headers: SEM_CACHE });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("apagar_chave_de_ia", { p_workspace_id: r.workspaceId, p_encaixe: encaixe });
  if (error?.hint === "ia_so_a_dona") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  if (error?.hint === "ia_encaixe_vazio") return NextResponse.json({ error: "encaixe_vazio" }, { status: 404, headers: SEM_CACHE });
  if (error) return NextResponse.json({ error: "nao_apagou" }, { status: 500, headers: SEM_CACHE });
  return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
}
