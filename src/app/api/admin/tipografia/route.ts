import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brennimark/contexto-da-rota";
import { lerManualDaMarca } from "@/lib/assets/regra-do-manual";
import { COLUNAS_DA_TIPOGRAFIA, LIMITES, deLinhaDaTipografia, lerFonteEscrita, type MotivoDaRecusa } from "@/lib/tipografia/tipografia";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * A tipografia da marca — 14/10/2026. O mesmo modelo da ficha da paleta.
 *
 * Quem pode é decidido pelo BANCO (`tipografia_da_marca`): lê quem consulta,
 * escreve quem edita, toda escrita volta a fonte a rascunho, e só rascunho se
 * apaga. Aprovar é a rota `aprovar`. Quando a escrita não alcança linha
 * nenhuma, é porque a policy recusou, e a resposta diz isso.
 *
 * A rota confere o que o banco não alcança: que a página existe no manual
 * ATUAL da marca.
 */

function recusa(motivo: MotivoDaRecusa, paginas: number | null) {
  const mensagens: Record<MotivoDaRecusa, [string, string]> = {
    uso: ["Choose the use.", "Escolha o uso."],
    segmento: [`Segment: up to ${LIMITES.segmento} characters.`, `Segmento: até ${LIMITES.segmento} caracteres.`],
    familia: [`Type the font family (up to ${LIMITES.familia} characters).`, `Digite a família da fonte (até ${LIMITES.familia} caracteres).`],
    estilo: [`Style: up to ${LIMITES.estilo} characters.`, `Estilo: até ${LIMITES.estilo} caracteres.`],
    postscript: ["The PostScript name has no spaces: letters, digits and hyphens, like BradescoSans-Bold.", "O nome PostScript não tem espaço: letras, números e hífen, como BradescoSans-Bold."],
    substituta: [`Substitute font: up to ${LIMITES.substituta} characters.`, `Fonte substituta: até ${LIMITES.substituta} caracteres.`],
    corpo: [`Size: a number above 0, up to ${LIMITES.corpo} pt.`, `Corpo: um número acima de 0, até ${LIMITES.corpo} pt.`],
    entrelinha: [`Leading: a number above 0, up to ${LIMITES.entrelinha} pt.`, `Entrelinha: um número acima de 0, até ${LIMITES.entrelinha} pt.`],
    espacejamento: ["Tracking: a whole number from -500 to 2000.", "Espacejamento: um número inteiro de -500 a 2000."],
    descricao: [`Description: up to ${LIMITES.descricao} characters.`, `Descrição: até ${LIMITES.descricao} caracteres.`],
    pagina: paginas
      ? [`The manual has ${paginas} pages.`, `O manual tem ${paginas} páginas.`]
      : ["Type the page number of the manual.", "Digite o número da página do manual."],
  };
  const [en, pt] = mensagens[motivo];
  return NextResponse.json({ message: isEnglish ? en : pt }, { status: 400 });
}

const SO_QUEM_EDITA = () => NextResponse.json(
  { message: isEnglish ? "Only who edits this brand changes the typography." : "Só quem edita esta marca altera a tipografia." },
  { status: 403 },
);
const JA_EXISTE = () => NextResponse.json(
  { message: isEnglish ? "There is already a font for this use and segment. Edit that one." : "Já existe uma fonte para este uso e segmento. Edite aquela." },
  { status: 409 },
);
const FALHOU = () => NextResponse.json(
  { message: isEnglish ? "Couldn't save the font." : "Não foi possível guardar a fonte." },
  { status: 500 },
);

async function fonteDoCorpo(request: Request, supabase: Parameters<typeof lerManualDaMarca>[0], workspaceId: string, brandId: string) {
  const corpo = await request.json().catch(() => null);
  const { manual } = await lerManualDaMarca(supabase, workspaceId, brandId);
  const paginas = manual?.paginas ?? null;
  return { corpo, lida: lerFonteEscrita(corpo, paginas), paginas };
}

export async function POST(request: Request) {
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId } = resolvido;

  const { lida, paginas } = await fonteDoCorpo(request, auth.supabase, workspaceId, brandId);
  if (!lida.ok) return recusa(lida.motivo, paginas);

  const { data, error } = await auth.supabase.from("tipografia_da_marca")
    .insert({ workspace_id: workspaceId, brand_id: brandId, ...lida.fonte })
    .select(COLUNAS_DA_TIPOGRAFIA)
    .single();
  // 42501: a policy recusou — quem pediu não edita esta marca.
  if (error?.code === "42501") return SO_QUEM_EDITA();
  if (error?.code === "23505") return JA_EXISTE();
  if (error || !data) return FALHOU();
  return NextResponse.json({ fonte: deLinhaDaTipografia(data as Record<string, unknown>) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId } = resolvido;

  const { corpo, lida, paginas } = await fonteDoCorpo(request, auth.supabase, workspaceId, brandId);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  if (!id) return NextResponse.json({ message: isEnglish ? "Choose a font." : "Escolha uma fonte." }, { status: 400 });
  if (!lida.ok) return recusa(lida.motivo, paginas);

  // Uso e segmento não mudam numa linha (o gatilho recusa): quem quer outro
  // uso remove e cria. Por isso só o resto vai no update.
  const f = lida.fonte;
  const { data, error } = await auth.supabase.from("tipografia_da_marca")
    .update({
      familia: f.familia, estilo: f.estilo, postscript: f.postscript, substituta: f.substituta, corpo: f.corpo, entrelinha: f.entrelinha,
      espacejamento: f.espacejamento, caixa_alta: f.caixa_alta, descricao: f.descricao, pagina: f.pagina, ordem: f.ordem,
    })
    .eq("id", id).eq("workspace_id", workspaceId).eq("brand_id", brandId)
    .select(COLUNAS_DA_TIPOGRAFIA);
  if (error) return FALHOU();
  if (!data || data.length === 0) return SO_QUEM_EDITA();
  return NextResponse.json({ fonte: deLinhaDaTipografia(data[0] as Record<string, unknown>) });
}

export async function DELETE(request: Request) {
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId } = resolvido;

  const corpo = await request.json().catch(() => null);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  if (!id) return NextResponse.json({ message: isEnglish ? "Choose a font." : "Escolha uma fonte." }, { status: 400 });

  // A policy só apaga RASCUNHO: a aprovada não some sem rastro.
  const { data, error } = await auth.supabase.from("tipografia_da_marca")
    .delete()
    .eq("id", id).eq("workspace_id", workspaceId).eq("brand_id", brandId)
    .select("id");
  if (error) return FALHOU();
  if (!data || data.length === 0) {
    return NextResponse.json(
      { message: isEnglish ? "Only drafts can be removed, and only by who edits this brand." : "Só fonte em rascunho se remove, e só quem edita esta marca remove." },
      { status: 403 },
    );
  }
  return NextResponse.json({ removida: id });
}
