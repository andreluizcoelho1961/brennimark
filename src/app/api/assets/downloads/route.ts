import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * Os downloads iniciados desta marca — "visível ao assinante", item 18 do ADR-0007.
 *
 * Iniciados: cada linha diz que a pessoa recebeu um endereço válido para o
 * arquivo naquele instante, não que a transferência terminou.
 *
 * Quem decide quem vê é a RLS de `brand_asset_downloads`: só quem tem
 * `administrar` naquela marca. Para qualquer outra pessoa esta consulta volta
 * vazia, e é assim que deve ser — o registro diz quem mais trabalha na marca e
 * com quais arquivos, que é informação de administração.
 *
 * Os 100 mais recentes, e não tudo. O registro cresce a cada clique e nunca
 * encolhe (ninguém apaga linha dele); uma tela que carregasse o histórico
 * inteiro ficaria mais lenta a cada semana de uso bem-sucedido.
 */
const LIMITE = 100;

export async function GET(request: Request) {
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, brandId } = resolvido;

  const { data, error } = await auth.supabase
    .from("brand_asset_downloads")
    .select("id, asset_id, pessoa_email, asset_label, file_name, created_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(LIMITE);

  if (error) {
    return NextResponse.json(
      { message: isEnglish ? "Couldn't load the download record." : "Não foi possível carregar o registro de downloads." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    downloads: (data ?? []).map((d) => ({
      id: d.id,
      // Nulo quando o arquivo foi apagado em definitivo. O rótulo e o nome
      // continuam — é por isso que o registro os guarda em texto.
      assetId: d.asset_id,
      pessoa: d.pessoa_email,
      rotulo: d.asset_label,
      arquivo: d.file_name,
      quando: d.created_at,
    })),
    limite: LIMITE,
  });
}
