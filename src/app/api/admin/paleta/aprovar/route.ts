import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brennimark/contexto-da-rota";
import { COLUNAS_DA_PALETA, deLinha } from "@/lib/paleta/paleta";

const isEnglish = inEnglish(PRODUCT_LOCALE);
const MAXIMO_POR_PEDIDO = 200;

/**
 * Aprovar cores da ficha — ADR-0002: "a agência redige, o dono da marca
 * aprova". Vai pela função do banco `aprovar_cores_da_paleta`, que confere
 * `aprovar` em cada cor; é o caminho de quem aprova sem editar.
 *
 * Nenhuma aprovada quando havia o que aprovar = quem pediu não aprova esta
 * marca (a função responde igual para cor alheia e cor inexistente).
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
    return NextResponse.json({ message: isEnglish ? "Choose the colors to approve." : "Escolha as cores a aprovar." }, { status: 400 });
  }

  // Só as cores DESTA marca e ainda em rascunho vão à função: um id de outra
  // marca no pedido não vira "nenhuma aprovada" para as legítimas.
  const { data: pendentes, error: erroDeLeitura } = await auth.supabase.from("paleta_da_marca")
    .select("id")
    .in("id", ids).eq("workspace_id", workspaceId).eq("brand_id", brandId).eq("status", "draft");
  if (erroDeLeitura) {
    return NextResponse.json({ message: isEnglish ? "Couldn't approve." : "Não foi possível aprovar." }, { status: 500 });
  }
  const alvo = (pendentes ?? []).map((l) => String(l.id));
  if (alvo.length === 0) return NextResponse.json({ aprovadas: [] });

  const { data: quantas, error } = await auth.supabase.rpc("aprovar_cores_da_paleta", { p_ids: alvo });
  if (error) {
    return NextResponse.json({ message: isEnglish ? "Couldn't approve." : "Não foi possível aprovar." }, { status: 500 });
  }
  if (quantas === 0) {
    return NextResponse.json(
      { message: isEnglish ? "Only who approves this brand approves colors." : "Só quem aprova esta marca aprova cores." },
      { status: 403 },
    );
  }

  const { data: aprovadas } = await auth.supabase.from("paleta_da_marca")
    .select(COLUNAS_DA_PALETA).in("id", alvo).eq("brand_id", brandId);
  return NextResponse.json({ aprovadas: (aprovadas ?? []).map((l) => deLinha(l as Record<string, unknown>)) });
}
