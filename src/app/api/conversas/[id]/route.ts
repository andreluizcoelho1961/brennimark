import { NextResponse } from "next/server";
import { portaoDeIA } from "@/lib/brennimark/contexto-da-rota";
import { idDeConversa } from "@/lib/ai/conversas";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

/**
 * Uma conversa: abrir (as mensagens) e apagar — fatia 4d.
 *
 * Abrir passa pelo portão da marca e pela policy por autor: conversa alheia,
 * ou de marca que a pessoa não alcança mais, responde 404 — a mesma resposta
 * de "não existe", para não confirmar nada a quem sonda.
 *
 * Apagar NÃO passa pelo portão da marca: é direito de quem escreveu, mesmo
 * depois de perder o acesso (LGPD). Vai por `apagar_conversa`, que só confere
 * o autor. Sem conteúdo no log.
 */
const isEnglish = inEnglish(PRODUCT_LOCALE);
const naoEncontrada = () => NextResponse.json({
  message: isEnglish ? "Conversation not found." : "Conversa não encontrada.",
}, { status: 404 });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDeConversa((await params).id);
  if (!id) return naoEncontrada();
  const portao = await portaoDeIA(request, "chat");
  if (!portao.ok) return portao.resposta;

  const { data: conversa } = await portao.auth.supabase
    .from("conversas").select("id, titulo").eq("id", id).eq("brand_id", portao.brand.id).maybeSingle();
  if (!conversa) return naoEncontrada();

  const { data, error } = await portao.auth.supabase
    .from("mensagens_da_conversa")
    .select("papel, tipo, conteudo, paginas, regras, incompleta, criada_em")
    .eq("conversa_id", id)
    .order("criada_em", { ascending: true })
    .limit(400);
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "conversa_nao_aberta", code: error.code ?? "unknown" }));
    return NextResponse.json({ message: isEnglish ? "Couldn't open the conversation." : "Não foi possível abrir a conversa." }, { status: 500 });
  }
  return NextResponse.json({
    id: conversa.id,
    titulo: conversa.titulo,
    mensagens: (data ?? []).map((m) => ({
      papel: m.papel, tipo: m.tipo, conteudo: m.conteudo, paginas: m.paginas ?? {}, regras: m.regras ?? [],
      incompleta: Boolean(m.incompleta),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDeConversa((await params).id);
  if (!id) return naoEncontrada();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: isEnglish ? "Sign in again." : "Entre de novo." }, { status: 401 });

  const { data, error } = await supabase.rpc("apagar_conversa", { p_conversa: id });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "conversa_nao_apagada", code: error.code ?? "unknown" }));
    return NextResponse.json({ message: isEnglish ? "Couldn't delete the conversation." : "Não foi possível apagar a conversa." }, { status: 500 });
  }
  if (data !== 1) return naoEncontrada();
  return NextResponse.json({ apagada: true });
}
