import { NextResponse } from "next/server";
import { conteudoDaRota } from "@/lib/brennimark/contexto-da-rota";
import { COLUNAS_DAS_REGRAS, deLinhaDaRegra, regrasParaOKit, type RegraDoLogo } from "@/lib/kit/regras";
import { opcoesDoPapel, type VarianteDoKit } from "@/lib/kit/materiais-do-kit";
import { COLUNAS_DAS_REGRAS_DE_GRID, deLinhaDaRegraDeGrid, type RegraDeGrid } from "@/lib/grids/regras";
import { formatoParaOInDesign } from "@/lib/grids/marca";
import { FORMATOS } from "@/lib/grids/formatos";
import { BUCKETS, pertenceAMarca } from "@/lib/storage/caminhos";

/**
 * O Grids do assinante (14/10/2026): o que o documento leva da marca.
 *
 * GET   as regras de grid (`regras_de_grid`, pela sessão: a RLS só devolve a
 *       quem consulta esta marca), o logo dos Materiais que o InDesign coloca,
 *       as cores APROVADAS da paleta (com o CMYK declarado), as regras do logo
 *       (área de proteção e redução mínima, do Kit) e o que a pessoa pode fazer;
 * PATCH quem edita guarda o grid de um formato como regra da marca (sempre
 *       rascunho: o gatilho do banco garante; alterar uma aprovada a devolve
 *       a rascunho).
 */
const SEM_CACHE = { "Cache-Control": "private, no-store" };
const VALIDADE_DA_MINIATURA_S = 600;

export async function GET(request: Request) {
  const r = await conteudoDaRota(request);
  if (!r.ok) return r.resposta;
  const { contexto, auth } = r;
  if (!contexto.brand) return NextResponse.json({ error: "sem_marca" }, { status: 409 });
  const brandId = contexto.brand.id;

  const [regras, regrasDoLogo, variantes, paleta, rascunhos] = await Promise.all([
    auth.supabase.from("regras_de_grid").select(COLUNAS_DAS_REGRAS_DE_GRID).eq("brand_id", brandId),
    auth.supabase.from("regras_do_logo").select(COLUNAS_DAS_REGRAS).eq("brand_id", brandId),
    auth.supabase.from("brand_assets")
      .select("id, item_id, label, file_name, mime_type, hierarquia, lockup, cor, polaridade, espaco_de_cor, miniatura_path, brand_asset_items!inner(tipo)")
      .eq("workspace_id", auth.workspaceId).eq("brand_id", brandId).is("descontinuado_em", null)
      .eq("brand_asset_items.tipo", "logo"),
    // Só cor APROVADA entra no documento (ADR-0004 §3.2).
    auth.supabase.from("paleta_da_marca").select("nome, hex, cmyk, pagina").eq("brand_id", brandId).eq("status", "ready").order("ordem"),
    auth.supabase.from("paleta_da_marca").select("id", { count: "exact", head: true }).eq("brand_id", brandId).eq("status", "draft"),
  ]);
  if (regras.error || regrasDoLogo.error || variantes.error || paleta.error) {
    return NextResponse.json({ message: "Não foi possível ler as regras da marca." }, { status: 503, headers: SEM_CACHE });
  }

  const caminhos = (variantes.data ?? [])
    .map((l: Record<string, unknown>) => l.miniatura_path as string | null)
    .filter((c): c is string => Boolean(c) && pertenceAMarca(c!, auth.workspaceId, brandId));
  const miniaturas = new Map<string, string>();
  if (caminhos.length > 0) {
    const { data: assinadas } = await auth.supabase.storage.from(BUCKETS.assets).createSignedUrls(caminhos, VALIDADE_DA_MINIATURA_S);
    for (const a of assinadas ?? []) if (a.path && a.signedUrl) miniaturas.set(a.path, a.signedUrl);
  }
  const logos: VarianteDoKit[] = (variantes.data ?? []).map((l: Record<string, unknown>) => ({
    id: String(l.id), itemId: String(l.item_id), tipo: "logo", arquivo: String(l.file_name ?? ""), mime: String(l.mime_type ?? ""),
    hierarquia: (l.hierarquia as string | null) ?? null, lockup: (l.lockup as string | null) ?? null, cor: (l.cor as string | null) ?? null,
    polaridade: (l.polaridade as string | null) ?? null, espacoDeCor: (l.espaco_de_cor as string | null) ?? null,
    rotulo: (l.label as string | null) ?? null,
    miniatura: l.miniatura_path ? (miniaturas.get(String(l.miniatura_path)) ?? null) : null,
  }));
  // As versões que o InDesign coloca, da melhor para a pior (a ordem do Kit).
  const versoesDoLogo = opcoesDoPapel(logos, "logo").filter((o) => o.abre && formatoParaOInDesign(o.variante.arquivo, o.variante.mime)).map((o) => o.variante);
  const foraDoInDesign = logos.filter((v) => !formatoParaOInDesign(v.arquivo, v.mime)).map((v) => v.arquivo);

  const doLogo = (regrasDoLogo.data ?? []).map((l) => deLinhaDaRegra(l as Record<string, unknown>)).filter((x): x is RegraDoLogo => x !== null);
  return NextResponse.json({
    marca: contexto.brand.brand.name,
    regras: (regras.data ?? []).map((l) => deLinhaDaRegraDeGrid(l as Record<string, unknown>)).filter((x): x is RegraDeGrid => x !== null),
    versoesDoLogo,
    foraDoInDesign,
    paleta: paleta.data ?? [],
    coresEmRascunho: rascunhos.count ?? 0,
    regrasDoLogo: { ...regrasParaOKit(doLogo), regras: doLogo },
    podeEditar: contexto.capabilities.includes("editar"),
    podeAprovar: contexto.capabilities.includes("aprovar"),
  }, { headers: SEM_CACHE });
}

const IDS = new Set(["todos", ...FORMATOS.map((f) => f.id)]);
const numOuNulo = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export async function PATCH(request: Request) {
  const r = await conteudoDaRota(request);
  if (!r.ok) return r.resposta;
  const { contexto, auth } = r;
  if (!contexto.brand) return NextResponse.json({ error: "sem_marca" }, { status: 409 });
  if (!contexto.capabilities.includes("editar")) {
    return NextResponse.json({ message: "Só quem edita esta marca guarda regras de grid." }, { status: 403 });
  }
  const c = await request.json().catch(() => null);
  const formato = typeof c?.formato === "string" ? c.formato : "";
  if (!IDS.has(formato)) return NextResponse.json({ message: "Formato desconhecido." }, { status: 400 });
  const unidade = formato === "todos" ? "proporcao" : FORMATOS.find((f) => f.id === formato)!.unidade;
  const campos = ["colunas", "linhas", "medianiz", "margem_sup", "margem_inf", "margem_esq", "margem_dir", "linha_de_base"] as const;
  const valores = Object.fromEntries(campos.map((k) => [k, numOuNulo(c?.[k])]));
  if (Object.values(valores).some((v) => v !== null && !Number.isFinite(v))) return NextResponse.json({ message: "Valor inválido." }, { status: 400 });
  const pagina = numOuNulo(c?.pagina);
  if (pagina !== null && !(Number.isInteger(pagina) && pagina >= 1)) return NextResponse.json({ message: "Página inválida." }, { status: 400 });
  const zonas = Array.isArray(c?.zonas) ? (c.zonas as unknown[]).map(Number) : null;

  const linha = {
    workspace_id: auth.workspaceId, brand_id: contexto.brand.id, formato, tipo: String(c?.tipo ?? ""), unidade,
    ...valores, zonas, pagina, descricao: typeof c?.descricao === "string" ? c.descricao.slice(0, 300) : "",
  };
  const { data, error } = await auth.supabase.from("regras_de_grid")
    .upsert(linha, { onConflict: "brand_id,formato" }).select(COLUNAS_DAS_REGRAS_DE_GRID).single();
  if (error?.code === "23514") return NextResponse.json({ message: "Algum valor está fora do que uma regra de grid admite." }, { status: 400 });
  if (error?.code === "42501") return NextResponse.json({ message: "Só quem edita esta marca guarda regras de grid." }, { status: 403 });
  if (error || !data) return NextResponse.json({ message: "Não foi possível guardar a regra." }, { status: 500 });
  return NextResponse.json({ regra: deLinhaDaRegraDeGrid(data as Record<string, unknown>) }, { headers: SEM_CACHE });
}
