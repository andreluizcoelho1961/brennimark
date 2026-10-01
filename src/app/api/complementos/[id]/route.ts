import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { conteudoDaRota } from "@/lib/brennimark/contexto-da-rota";
import { ehAcao, lerTextoDoComplemento, mensagemDaRecusa } from "@/lib/complementos/complementos";

const isEnglish = inEnglish(PRODUCT_LOCALE);
const SEM_CACHE = { "Cache-Control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * As ações sobre UM complemento — salvar rascunho, publicar, descartar,
 * arquivar, reativar (01/10/2026). Cada uma é uma função do banco que confere
 * `editar` na marca do complemento; complemento inexistente e de marca alheia
 * respondem igual (404). Publicar é aprovar (decisão 75).
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "nao_encontrado" }, { status: 404, headers: SEM_CACHE });
  const resolvido = await conteudoDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { supabase } = resolvido.auth;

  const corpo = await request.json().catch(() => null);
  const acao = corpo?.acao;
  if (!ehAcao(acao)) return NextResponse.json({ message: isEnglish ? "Unknown action." : "Ação desconhecida." }, { status: 400, headers: SEM_CACHE });

  let resposta;
  if (acao === "salvar") {
    const lido = lerTextoDoComplemento(corpo, isEnglish);
    if (!lido.ok) return NextResponse.json({ message: lido.mensagem }, { status: 400, headers: SEM_CACHE });
    resposta = await supabase.rpc("salvar_rascunho_de_complemento", { p_id: id, p_titulo: lido.titulo, p_texto: lido.texto });
  } else if (acao === "publicar") {
    resposta = await supabase.rpc("publicar_complemento", { p_id: id });
  } else if (acao === "descartar") {
    resposta = await supabase.rpc("descartar_rascunho_de_complemento", { p_id: id });
  } else {
    resposta = await supabase.rpc("arquivar_complemento", { p_id: id, p_arquivar: acao === "arquivar" });
  }

  const { data, error } = resposta;
  if (error?.code === "42501") return NextResponse.json({ error: "nao_encontrado" }, { status: 404, headers: SEM_CACHE });
  if (error) {
    return NextResponse.json({ message: mensagemDaRecusa(error.hint, isEnglish) }, { status: error.code === "23514" ? 400 : 500, headers: SEM_CACHE });
  }
  return NextResponse.json({ ok: true, versao: acao === "publicar" ? data : undefined }, { headers: SEM_CACHE });
}
