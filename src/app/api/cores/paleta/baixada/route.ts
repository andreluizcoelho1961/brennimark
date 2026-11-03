import { NextResponse } from "next/server";
import { inEnglish } from "@/platform/locale";
import { idiomaDaSessao } from "@/lib/idioma-da-sessao";
import { marcaDaRota } from "@/lib/brennimark/contexto-da-rota";
import { FORMATOS_DA_PALETA, lerPedidoDeDownloadDaPaleta } from "@/lib/cores/download-da-paleta";

/**
 * O clique em "baixar a paleta" (ASE, CSS, JSON, PNG) — registrado ANTES de o
 * navegador montar o arquivo (03/11/2026).
 *
 * A paleta nasce no navegador, das cores aprovadas do manual, e não passa por
 * `brand_assets`; por isso tem tabela própria (`downloads_de_paleta`, ver a
 * migration). Quem grava é a SESSÃO da pessoa, sem chave de serviço: a policy
 * exige `consultar` na marca e o gatilho preenche pessoa, e-mail e conta. O
 * pedido só diz o formato e quantas cores — o resto, se vier, é descartado.
 *
 * O registro é do clique, não do arquivo: não prova que o download terminou.
 */
export async function POST(request: Request) {
  const isEnglish = inEnglish(await idiomaDaSessao());
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, brandId } = resolvido;

  const pedido = lerPedidoDeDownloadDaPaleta(await request.json().catch(() => null));
  if (!pedido) {
    return NextResponse.json(
      { message: isEnglish ? `Choose a format (${FORMATOS_DA_PALETA.join(", ")}).` : `Escolha um formato (${FORMATOS_DA_PALETA.join(", ")}).` },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { error } = await auth.supabase.from("downloads_de_paleta").insert({
    brand_id: brandId, pessoa: auth.user.id, pessoa_email: "", formato: pedido.formato, cores: pedido.cores,
    // Preenchido pelo gatilho a partir da marca; o valor aqui é só para o tipo.
    workspace_id: resolvido.workspaceId,
  });
  if (error) {
    return NextResponse.json(
      { message: isEnglish
        ? "The download couldn't be recorded, so it wasn't started. Try again."
        : "Não foi possível registrar o download, então ele não foi iniciado. Tente de novo." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
