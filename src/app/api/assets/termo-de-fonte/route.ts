import { NextResponse } from "next/server";
import { inEnglish } from "@/platform/locale";
import { idiomaDaSessao } from "@/lib/idioma-da-sessao";
import { autenticacaoDaRota } from "@/lib/brennimark/contexto-da-rota";

/**
 * O termo de hospedagem de fonte, na versão vigente (ADR-0007 §3, 03/11/2026).
 *
 * A tela mostra o TEXTO e a versão antes de a pessoa aceitar, e o envio diz
 * qual versão foi aceita. Quem escreve o texto é a migration: aqui só se lê,
 * com a sessão (a policy deixa qualquer pessoa autenticada ler).
 */
export async function GET(request: Request) {
  const isEnglish = inEnglish(await idiomaDaSessao());
  const resolvido = await autenticacaoDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { data, error } = await resolvido.contexto.supabase.from("versoes_do_termo_de_fonte")
    .select("versao, texto_pt, texto_en").order("publicada_em", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) {
    return NextResponse.json({ message: isEnglish ? "The terms aren't available right now." : "O termo não está disponível agora." }, { status: 503 });
  }
  return NextResponse.json({ versao: data.versao, texto: isEnglish ? data.texto_en : data.texto_pt }, { headers: { "Cache-Control": "private, no-store" } });
}
