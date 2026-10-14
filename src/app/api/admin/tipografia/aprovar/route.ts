import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brennimark/contexto-da-rota";
import { COLUNAS_DA_TIPOGRAFIA, deLinhaDaTipografia } from "@/lib/tipografia/tipografia";

const isEnglish = inEnglish(PRODUCT_LOCALE);
const MAXIMO_POR_PEDIDO = 50;

/**
 * Aprovar fontes da tipografia — ADR-0002: "a agência redige, o dono da marca
 * aprova". Vai pela função `aprovar_tipografia_da_marca`, que confere
 * `aprovar` em cada linha; é o caminho de quem aprova sem editar.
 *
 * Só as linhas DESTA marca e em rascunho vão à função, para um id alheio no
 * pedido não virar "nenhuma aprovada" para as legítimas.
 */
export async function POST(request: Request) {
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId } = resolvido;

  const corpo = await request.json().catch(() => null);
  const ids = Array.isArray(corpo?.ids)
    ? [...new Set((corpo.ids as unknown[]).filter((v): v is string => typeof v === "string"))]
    : [];
  if (ids.length === 0 || ids.length > MAXIMO_POR_PEDIDO) {
    return NextResponse.json({ message: isEnglish ? "Choose the fonts to approve." : "Escolha as fontes a aprovar." }, { status: 400 });
  }

  const falhou = () => NextResponse.json({ message: isEnglish ? "Couldn't approve." : "Não foi possível aprovar." }, { status: 500 });
  const { data: pendentes, error: erroDeLeitura } = await auth.supabase.from("tipografia_da_marca")
    .select("id")
    .in("id", ids).eq("workspace_id", workspaceId).eq("brand_id", brandId).eq("status", "draft");
  if (erroDeLeitura) return falhou();
  const alvo = (pendentes ?? []).map((l) => String(l.id));
  if (alvo.length === 0) return NextResponse.json({ aprovadas: [] });

  const { data: quantas, error } = await auth.supabase.rpc("aprovar_tipografia_da_marca", { p_ids: alvo });
  if (error) return falhou();
  if (quantas === 0) {
    return NextResponse.json(
      { message: isEnglish ? "Only who approves this brand approves fonts." : "Só quem aprova esta marca aprova fontes." },
      { status: 403 },
    );
  }

  const { data: aprovadas } = await auth.supabase.from("tipografia_da_marca")
    .select(COLUNAS_DA_TIPOGRAFIA).in("id", alvo).eq("brand_id", brandId);
  return NextResponse.json({ aprovadas: (aprovadas ?? []).map((l) => deLinhaDaTipografia(l as Record<string, unknown>)).filter(Boolean) });
}
