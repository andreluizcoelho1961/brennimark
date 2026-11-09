import { idiomaDaSessao } from "@/lib/idioma-da-sessao";
import { inEnglish } from "@/platform/locale";
import { NextResponse } from "next/server";
import { conteudoDaRota } from "@/lib/brennimark/contexto-da-rota";
import { COLUNAS_DAS_REGRAS, CHAVES_DAS_REGRAS, deLinhaDaRegra, type ChaveDaRegra, type RegraDoLogo } from "@/lib/kit/regras";
import { getTranslations } from "next-intl/server";
import { escolherDesenhos, type VarianteDoKit } from "@/lib/kit/materiais-do-kit";
import { BUCKETS, pertenceAMarca } from "@/lib/storage/caminhos";
import { fonteDaAssinatura } from "@/lib/kit/fonte-da-assinatura";

/**
 * O Kit do assinante (10/10/2026): as regras do logo da marca e os desenhos
 * dos Materiais.
 *
 * GET   regras (pela sessão: a RLS só devolve a quem consulta esta marca),
 *       os desenhos escolhidos nos Materiais, TODAS as versões de logo e
 *       símbolo com a miniatura (para a pessoa trocar), a fonte da assinatura
 *       (a substituta APROVADA do uso "texto"; 14/10/2026) e o que ela pode fazer;
 * PATCH quem edita corrige o valor de uma regra (o banco devolve a rascunho e
 *       anota `origem = 'pessoa'`).
 */
const SEM_CACHE = { "Cache-Control": "private, no-store" };
/** Como nos Materiais: a miniatura se vê por 10 minutos e não é o arquivo. */
const VALIDADE_DA_MINIATURA_S = 600;

export async function GET(request: Request) {
  const isEnglish = inEnglish(await idiomaDaSessao());
  const r = await conteudoDaRota(request);
  if (!r.ok) return r.resposta;
  const { contexto, auth } = r;
  if (!contexto.brand) return NextResponse.json({ error: "sem_marca" }, { status: 409 });
  const brandId = contexto.brand.id;

  const [regras, variantes, paleta, texto] = await Promise.all([
    auth.supabase.from("regras_do_logo").select(COLUNAS_DAS_REGRAS).eq("brand_id", brandId),
    auth.supabase.from("brand_assets")
      .select("id, item_id, label, file_name, mime_type, hierarquia, lockup, cor, polaridade, espaco_de_cor, miniatura_path, brand_asset_items!inner(tipo)")
      .eq("workspace_id", auth.workspaceId).eq("brand_id", brandId).is("descontinuado_em", null)
      .in("brand_asset_items.tipo", ["logo", "icone"]),
    // Só cor APROVADA vira opção de fundo em silêncio (ADR-0004 §3.2).
    auth.supabase.from("paleta_da_marca").select("hex").eq("brand_id", brandId).eq("status", "ready").not("hex", "is", null).order("ordem"),
    // Só fonte APROVADA entra em silêncio (ADR-0004 §3.2).
    auth.supabase.from("tipografia_da_marca").select("segmento, substituta, pagina").eq("brand_id", brandId).eq("uso", "texto").eq("status", "ready"),
  ]);
  if (regras.error || variantes.error) {
    return NextResponse.json({ message: (isEnglish ? "Couldn't read the brand's Materials." : "Não foi possível ler os Materiais da marca.") }, { status: 503, headers: SEM_CACHE });
  }

  // As miniaturas, assinadas com a SESSÃO numa ida só, e só as da pasta desta
  // marca (a constraint do banco garante; a rota não confia sozinha nisso).
  const caminhos = (variantes.data ?? [])
    .map((l: Record<string, unknown>) => l.miniatura_path as string | null)
    .filter((c): c is string => Boolean(c) && pertenceAMarca(c!, auth.workspaceId, brandId));
  const miniaturas = new Map<string, string>();
  if (caminhos.length > 0) {
    const { data: assinadas } = await auth.supabase.storage.from(BUCKETS.assets).createSignedUrls(caminhos, VALIDADE_DA_MINIATURA_S);
    for (const a of assinadas ?? []) if (a.path && a.signedUrl) miniaturas.set(a.path, a.signedUrl);
  }

  const lista: VarianteDoKit[] = (variantes.data ?? []).map((l: Record<string, unknown>) => {
    const item = l.brand_asset_items as { tipo: string } | { tipo: string }[] | null;
    const tipo = (Array.isArray(item) ? item[0]?.tipo : item?.tipo) === "icone" ? "icone" : "logo";
    return {
      id: String(l.id), itemId: String(l.item_id), tipo, arquivo: String(l.file_name ?? ""), mime: String(l.mime_type ?? ""),
      hierarquia: (l.hierarquia as string | null) ?? null, lockup: (l.lockup as string | null) ?? null, cor: (l.cor as string | null) ?? null,
      polaridade: (l.polaridade as string | null) ?? null, espacoDeCor: (l.espaco_de_cor as string | null) ?? null,
      rotulo: (l.label as string | null) ?? null,
      miniatura: l.miniatura_path ? (miniaturas.get(String(l.miniatura_path)) ?? null) : null,
    };
  });

  return NextResponse.json({
    marca: contexto.brand.brand.name,
    regras: (regras.data ?? []).map((l) => deLinhaDaRegra(l as Record<string, unknown>)).filter((x): x is RegraDoLogo => x !== null),
    desenhos: escolherDesenhos(lista, await getTranslations({ locale: isEnglish ? "en" : "pt-BR", namespace: "ferramentas.arquivos" })),
    versoes: lista,
    coresDaMarca: [...new Set((paleta.data ?? []).map((c) => String((c as { hex: string }).hex)))].slice(0, 12),
    // Falhar ao ler a tipografia não derruba o Kit: a assinatura fica em Arial.
    fonteDaAssinatura: texto.error ? null : fonteDaAssinatura((texto.data ?? []) as { segmento: string; substituta: string | null; pagina: number | null }[], await getTranslations({ locale: isEnglish ? "en" : "pt-BR", namespace: "ferramentas.kit" })),
    podeEditar: contexto.capabilities.includes("editar"),
    podeAprovar: contexto.capabilities.includes("aprovar"),
  }, { headers: SEM_CACHE });
}

export async function PATCH(request: Request) {
  const isEnglish = inEnglish(await idiomaDaSessao());
  const r = await conteudoDaRota(request);
  if (!r.ok) return r.resposta;
  const { contexto, auth } = r;
  if (!contexto.brand) return NextResponse.json({ error: "sem_marca" }, { status: 409 });
  if (!contexto.capabilities.includes("editar")) {
    return NextResponse.json({ message: (isEnglish ? "Only people who edit this brand correct the rules." : "Só quem edita esta marca corrige as regras.") }, { status: 403 });
  }

  const corpo = await request.json().catch(() => null);
  const chave = corpo?.chave as ChaveDaRegra;
  const valor = Number(corpo?.valor);
  const pagina = corpo?.pagina === null || corpo?.pagina === undefined || corpo?.pagina === "" ? null : Number(corpo.pagina);
  const descricao = typeof corpo?.descricao === "string" ? corpo.descricao.slice(0, 200) : "";
  if (!CHAVES_DAS_REGRAS.includes(chave) || !Number.isFinite(valor) || (pagina !== null && !(Number.isInteger(pagina) && pagina >= 1))) {
    return NextResponse.json({ message: (isEnglish ? "Invalid value." : "Valor inválido.") }, { status: 400 });
  }

  const linha = { workspace_id: auth.workspaceId, brand_id: contexto.brand.id, chave, valor, pagina, descricao };
  const { data, error } = await auth.supabase.from("regras_do_logo")
    .upsert(linha, { onConflict: "brand_id,chave" }).select(COLUNAS_DAS_REGRAS).single();
  if (error?.code === "23514") return NextResponse.json({ message: (isEnglish ? "That value is outside what a logo rule allows." : "Esse valor está fora do que uma regra de logo admite.") }, { status: 400 });
  if (error?.code === "42501") return NextResponse.json({ message: (isEnglish ? "Only people who edit this brand correct the rules." : "Só quem edita esta marca corrige as regras.") }, { status: 403 });
  if (error || !data) return NextResponse.json({ message: (isEnglish ? "Couldn't save the rule." : "Não foi possível guardar a regra.") }, { status: 500 });
  return NextResponse.json({ regra: deLinhaDaRegra(data as Record<string, unknown>) }, { headers: SEM_CACHE });
}
