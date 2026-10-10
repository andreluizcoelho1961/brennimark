import { NextResponse } from "next/server";
import { conteudoDaRota } from "@/lib/brennimark/contexto-da-rota";
import { COLUNAS_DAS_REGRAS, CHAVES_DAS_REGRAS, deLinhaDaRegra, type ChaveDaRegra, type RegraDoLogo } from "@/lib/kit/regras";
import { escolherDesenhos, type VarianteDoKit } from "@/lib/kit/materiais-do-kit";

/**
 * O Kit do assinante (10/10/2026): as regras do logo da marca e os desenhos
 * dos Materiais.
 *
 * GET   regras (pela sessão: a RLS só devolve a quem consulta esta marca),
 *       os desenhos escolhidos nos Materiais e o que a pessoa pode fazer;
 * PATCH quem edita corrige o valor de uma regra (o banco devolve a rascunho e
 *       anota `origem = 'pessoa'`).
 */
const SEM_CACHE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const r = await conteudoDaRota(request);
  if (!r.ok) return r.resposta;
  const { contexto, auth } = r;
  if (!contexto.brand) return NextResponse.json({ error: "sem_marca" }, { status: 409 });
  const brandId = contexto.brand.id;

  const [regras, variantes, paleta] = await Promise.all([
    auth.supabase.from("regras_do_logo").select(COLUNAS_DAS_REGRAS).eq("brand_id", brandId),
    auth.supabase.from("brand_assets")
      .select("id, item_id, file_name, mime_type, hierarquia, lockup, cor, polaridade, espaco_de_cor, brand_asset_items!inner(tipo)")
      .eq("brand_id", brandId).is("descontinuado_em", null)
      .in("brand_asset_items.tipo", ["logo", "icone"]),
    // Só cor APROVADA vira opção de fundo em silêncio (ADR-0004 §3.2).
    auth.supabase.from("paleta_da_marca").select("hex").eq("brand_id", brandId).eq("status", "ready").not("hex", "is", null).order("ordem"),
  ]);
  if (regras.error || variantes.error) {
    return NextResponse.json({ message: "Não foi possível ler os Materiais da marca." }, { status: 503, headers: SEM_CACHE });
  }

  const lista: VarianteDoKit[] = (variantes.data ?? []).map((l: Record<string, unknown>) => {
    const item = l.brand_asset_items as { tipo: string } | { tipo: string }[] | null;
    const tipo = (Array.isArray(item) ? item[0]?.tipo : item?.tipo) === "icone" ? "icone" : "logo";
    return {
      id: String(l.id), itemId: String(l.item_id), tipo, arquivo: String(l.file_name ?? ""), mime: String(l.mime_type ?? ""),
      hierarquia: (l.hierarquia as string | null) ?? null, lockup: (l.lockup as string | null) ?? null, cor: (l.cor as string | null) ?? null,
      polaridade: (l.polaridade as string | null) ?? null, espacoDeCor: (l.espaco_de_cor as string | null) ?? null,
    };
  });

  return NextResponse.json({
    marca: contexto.brand.brand.name,
    regras: (regras.data ?? []).map((l) => deLinhaDaRegra(l as Record<string, unknown>)).filter((x): x is RegraDoLogo => x !== null),
    desenhos: escolherDesenhos(lista),
    coresDaMarca: [...new Set((paleta.data ?? []).map((c) => String((c as { hex: string }).hex)))].slice(0, 12),
    podeEditar: contexto.capabilities.includes("editar"),
    podeAprovar: contexto.capabilities.includes("aprovar"),
  }, { headers: SEM_CACHE });
}

export async function PATCH(request: Request) {
  const r = await conteudoDaRota(request);
  if (!r.ok) return r.resposta;
  const { contexto, auth } = r;
  if (!contexto.brand) return NextResponse.json({ error: "sem_marca" }, { status: 409 });
  if (!contexto.capabilities.includes("editar")) {
    return NextResponse.json({ message: "Só quem edita esta marca corrige as regras." }, { status: 403 });
  }

  const corpo = await request.json().catch(() => null);
  const chave = corpo?.chave as ChaveDaRegra;
  const valor = Number(corpo?.valor);
  const pagina = corpo?.pagina === null || corpo?.pagina === undefined || corpo?.pagina === "" ? null : Number(corpo.pagina);
  const descricao = typeof corpo?.descricao === "string" ? corpo.descricao.slice(0, 200) : "";
  if (!CHAVES_DAS_REGRAS.includes(chave) || !Number.isFinite(valor) || (pagina !== null && !(Number.isInteger(pagina) && pagina >= 1))) {
    return NextResponse.json({ message: "Valor inválido." }, { status: 400 });
  }

  const linha = { workspace_id: auth.workspaceId, brand_id: contexto.brand.id, chave, valor, pagina, descricao };
  const { data, error } = await auth.supabase.from("regras_do_logo")
    .upsert(linha, { onConflict: "brand_id,chave" }).select(COLUNAS_DAS_REGRAS).single();
  if (error?.code === "23514") return NextResponse.json({ message: "Esse valor está fora do que uma regra de logo admite." }, { status: 400 });
  if (error?.code === "42501") return NextResponse.json({ message: "Só quem edita esta marca corrige as regras." }, { status: 403 });
  if (error || !data) return NextResponse.json({ message: "Não foi possível guardar a regra." }, { status: 500 });
  return NextResponse.json({ regra: deLinhaDaRegra(data as Record<string, unknown>) }, { headers: SEM_CACHE });
}
