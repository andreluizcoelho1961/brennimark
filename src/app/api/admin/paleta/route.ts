import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brennimark/contexto-da-rota";
import { lerManualDaMarca } from "@/lib/assets/regra-do-manual";
import { COLUNAS_DA_PALETA, deLinha, lerCorEscrita, type MotivoDaRecusa } from "@/lib/paleta/paleta";
import { conferirPaleta } from "@/lib/paleta/conferencia";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * A ficha da paleta da marca — 27/09/2026.
 *
 * Quem pode é decidido pelo BANCO (`paleta_da_marca`): lê quem consulta,
 * escreve quem edita, e toda escrita volta a cor a rascunho — aprovar é a rota
 * `aprovar`, e só para quem aprova. A rota não repete a regra; quando a escrita
 * não alcança linha nenhuma, é porque a policy recusou, e a resposta diz isso.
 *
 * A rota confere o que o banco não alcança: que a página existe no manual
 * ATUAL da marca.
 */

function recusa(motivo: MotivoDaRecusa, paginas: number | null) {
  const mensagens: Record<MotivoDaRecusa, [string, string]> = {
    nome: ["Give the color a name (up to 80 characters).", "Dê um nome à cor (até 80 caracteres)."],
    papel: ["Choose primary or support.", "Escolha principal ou apoio."],
    segmento: ["Segment: up to 80 characters.", "Segmento: até 80 caracteres."],
    hex: ["HEX is six digits, like #CC092F.", "O HEX tem seis dígitos, como #CC092F."],
    "codigo-longo": ["Each code: up to 40 characters.", "Cada código: até 40 caracteres."],
    "sem-codigo": ["Fill in at least one code: HEX, RGB, CMYK or PMS.", "Preencha ao menos um código: HEX, RGB, CMYK ou PMS."],
    pagina: paginas
      ? [`The manual has ${paginas} pages.`, `O manual tem ${paginas} páginas.`]
      : ["Type the page number of the manual.", "Digite o número da página do manual."],
  };
  const [en, pt] = mensagens[motivo];
  return NextResponse.json({ message: isEnglish ? en : pt }, { status: 400 });
}

const SO_QUEM_EDITA = () => NextResponse.json(
  { message: isEnglish ? "Only who edits this brand changes the palette." : "Só quem edita esta marca altera a paleta." },
  { status: 403 },
);
const FALHOU = () => NextResponse.json(
  { message: isEnglish ? "Couldn't save the color." : "Não foi possível guardar a cor." },
  { status: 500 },
);

async function corDoCorpo(request: Request, supabase: Parameters<typeof lerManualDaMarca>[0], workspaceId: string, brandId: string) {
  const corpo = await request.json().catch(() => null);
  const { manual } = await lerManualDaMarca(supabase, workspaceId, brandId);
  const paginas = manual?.paginas ?? null;
  return { corpo, lida: lerCorEscrita(corpo, paginas), paginas };
}

export async function POST(request: Request) {
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId } = resolvido;

  const { lida, paginas } = await corDoCorpo(request, auth.supabase, workspaceId, brandId);
  if (!lida.ok) return recusa(lida.motivo, paginas);

  const { data, error } = await auth.supabase.from("paleta_da_marca")
    .insert({ workspace_id: workspaceId, brand_id: brandId, ...lida.cor })
    .select(COLUNAS_DA_PALETA)
    .single();
  // 42501: a policy recusou — quem pediu não edita esta marca.
  if (error?.code === "42501") return SO_QUEM_EDITA();
  if (error || !data) return FALHOU();
  const [cor] = await conferirPaleta(auth.supabase, brandId, [deLinha(data as Record<string, unknown>)]);
  return NextResponse.json({ cor }, { status: 201 });
}

export async function PATCH(request: Request) {
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId } = resolvido;

  const { corpo, lida, paginas } = await corDoCorpo(request, auth.supabase, workspaceId, brandId);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  if (!id) return NextResponse.json({ message: isEnglish ? "Choose a color." : "Escolha uma cor." }, { status: 400 });
  if (!lida.ok) return recusa(lida.motivo, paginas);

  const { data, error } = await auth.supabase.from("paleta_da_marca")
    .update(lida.cor)
    .eq("id", id).eq("workspace_id", workspaceId).eq("brand_id", brandId)
    .select(COLUNAS_DA_PALETA);
  if (error) return FALHOU();
  if (!data || data.length === 0) return SO_QUEM_EDITA();
  const [cor] = await conferirPaleta(auth.supabase, brandId, [deLinha(data[0] as Record<string, unknown>)]);
  return NextResponse.json({ cor });
}

export async function DELETE(request: Request) {
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId } = resolvido;

  const corpo = await request.json().catch(() => null);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  if (!id) return NextResponse.json({ message: isEnglish ? "Choose a color." : "Escolha uma cor." }, { status: 400 });

  const { data, error } = await auth.supabase.from("paleta_da_marca")
    .delete()
    .eq("id", id).eq("workspace_id", workspaceId).eq("brand_id", brandId)
    .select("id");
  if (error) return FALHOU();
  if (!data || data.length === 0) return SO_QUEM_EDITA();
  return NextResponse.json({ removida: id });
}
