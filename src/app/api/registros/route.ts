import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { autenticacaoDaRota } from "@/lib/brennimark/contexto-da-rota";
import { rotuloDaPessoa } from "@/lib/acesso/conta-removida";
import {
  LINHAS_POR_PAGINA, intervalo, lerFiltros, mesclarPorData, proximoCursor,
  type Filtros, type LinhaDeAcao, type LinhaDeAcesso, type LinhaDeDownload,
} from "@/lib/registros/registros";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * Registros da CONTA — downloads, acessos e ações (28/09/2026).
 *
 * Quem vê o quê é decidido pelo BANCO. As três tabelas de registro só
 * entregam linhas das marcas em que a sessão tem `administrar`
 * (`brand_asset_downloads`, `downloads_do_manual`, `brand_access_log`); o
 * histórico de conteúdo, das que ela consulta. A rota filtra pela conta do
 * endereço e pelos filtros da tela — nunca autoriza nada por conta própria, e
 * não usa chave de serviço.
 *
 * Cada aba lê até uma página ANTES do cursor, do mais recente para trás.
 */

type Consulta<T> = { data: T[] | null; error: { message: string } | null };

/** O mínimo do construtor de consulta que os filtros usam (o tipo completo do
 *  PostgREST estoura o limite de profundidade do TypeScript num genérico). */
type Filtravel = {
  eq: (c: string, v: string) => Filtravel;
  gte: (c: string, v: string) => Filtravel;
  lt: (c: string, v: string) => Filtravel;
};

function aplicarFiltros<Q>(consulta: Q, f: Filtros): Q {
  let q = consulta as unknown as Filtravel;
  if (f.marca) q = q.eq("brand_id", f.marca);
  const { desde, ate } = intervalo(f);
  if (desde) q = q.gte("created_at", desde);
  if (ate) q = q.lt("created_at", ate);
  return q as unknown as Q;
}

async function nomesDasMarcas(supabase: SupabaseClient, workspaceId: string): Promise<Map<string, string>> {
  const { data } = await supabase.from("brands").select("id, name").eq("workspace_id", workspaceId);
  return new Map((data ?? []).map((b: { id: string; name: string }) => [b.id, b.name]));
}

async function downloads(supabase: SupabaseClient, workspaceId: string, f: Filtros, marcas: Map<string, string>) {
  let materiais = supabase.from("brand_asset_downloads")
    .select("id, brand_id, pessoa_email, asset_label, file_name, created_at")
    .eq("workspace_id", workspaceId);
  let manual = supabase.from("downloads_do_manual")
    .select("id, brand_id, pessoa_email, file_name, created_at")
    .eq("workspace_id", workspaceId);
  // Por link de entrega (30/09/2026): quem baixou não tem conta e se
  // identificou com nome e e-mail autodeclarados.
  let porLink = supabase.from("acessos_de_link")
    .select("id, brand_id, nome, email, link_nome, asset_label, file_name, created_at")
    .eq("workspace_id", workspaceId)
    .eq("evento", "baixou");
  materiais = aplicarFiltros(materiais, f);
  manual = aplicarFiltros(manual, f);
  porLink = aplicarFiltros(porLink, f);
  if (f.pessoa) {
    materiais = materiais.ilike("pessoa_email", `%${f.pessoa}%`);
    manual = manual.ilike("pessoa_email", `%${f.pessoa}%`);
    // Mesmo cuidado dos acessos: `lerFiltros` só deixa passar caracteres
    // seguros, e o valor vai ENTRE ASPAS no filtro.
    porLink = porLink.or(`email.ilike."%${f.pessoa}%",nome.ilike."%${f.pessoa}%"`);
  }
  const [a, b, c] = await Promise.all([
    materiais.order("created_at", { ascending: false }).limit(LINHAS_POR_PAGINA) as unknown as Promise<Consulta<Record<string, string>>>,
    manual.order("created_at", { ascending: false }).limit(LINHAS_POR_PAGINA) as unknown as Promise<Consulta<Record<string, string>>>,
    porLink.order("created_at", { ascending: false }).limit(LINHAS_POR_PAGINA) as unknown as Promise<Consulta<Record<string, string>>>,
  ]);
  if (a.error || b.error || c.error) return null;
  const deMateriais: LinhaDeDownload[] = (a.data ?? []).map((l) => ({
    id: l.id, tipo: "material", marca: marcas.get(l.brand_id) ?? "—", pessoa: rotuloDaPessoa(l.pessoa_email, isEnglish),
    oque: l.asset_label, arquivo: l.file_name, quando: l.created_at,
  }));
  const doManual: LinhaDeDownload[] = (b.data ?? []).map((l) => ({
    id: l.id, tipo: "manual", marca: marcas.get(l.brand_id) ?? "—", pessoa: rotuloDaPessoa(l.pessoa_email, isEnglish),
    oque: isEnglish ? "Manual (PDF)" : "Manual (PDF)", arquivo: l.file_name, quando: l.created_at,
  }));
  const deLinks: LinhaDeDownload[] = (c.data ?? []).map((l) => ({
    id: l.id, tipo: "link", via: l.link_nome, marca: marcas.get(l.brand_id) ?? "—",
    pessoa: `${l.nome} · ${l.email}`, oque: l.asset_label, arquivo: l.file_name, quando: l.created_at,
  }));
  return mesclarPorData([deMateriais, doManual, deLinks]);
}

async function acessos(supabase: SupabaseClient, workspaceId: string, f: Filtros, marcas: Map<string, string>) {
  let q = supabase.from("brand_access_log")
    .select("id, brand_id, pessoa_email, autor_email, acao, capacidades_antes, capacidades_depois, created_at")
    .eq("workspace_id", workspaceId);
  q = aplicarFiltros(q, f);
  // Seguro: `lerFiltros` só deixa passar letras, números, espaço e . _ @ + -
  // — nem vírgula, nem parêntese, nem aspas. E o valor vai ENTRE ASPAS, para o
  // ponto de um e-mail e o espaço de um nome nunca virarem sintaxe do filtro.
  if (f.pessoa) q = q.or(`pessoa_email.ilike."%${f.pessoa}%",autor_email.ilike."%${f.pessoa}%"`);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(LINHAS_POR_PAGINA);
  if (error) return null;
  return (data ?? []).map((l): LinhaDeAcesso => ({
    id: l.id, marca: marcas.get(l.brand_id) ?? "—",
    pessoa: rotuloDaPessoa(l.pessoa_email, isEnglish), autor: rotuloDaPessoa(l.autor_email, isEnglish),
    acao: l.acao, antes: l.capacidades_antes ?? [], depois: l.capacidades_depois ?? [], quando: l.created_at,
  }));
}

async function acoes(supabase: SupabaseClient, workspaceId: string, f: Filtros, marcas: Map<string, string>) {
  let q = supabase.from("brand_document_versions")
    // Só o título do retrato: o documento inteiro não é assunto do registro.
    .select("id, brand_id, slug, action, actor_label, created_at, titulo:snapshot->>title")
    .eq("workspace_id", workspaceId)
    .not("brand_id", "is", null);
  q = aplicarFiltros(q, f);
  if (f.pessoa) q = q.ilike("actor_label", `%${f.pessoa}%`);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(LINHAS_POR_PAGINA);
  if (error) return null;
  return (data ?? []).map((l): LinhaDeAcao => ({
    id: l.id, marca: marcas.get(l.brand_id) ?? "—", autor: rotuloDaPessoa(l.actor_label, isEnglish),
    acao: l.action, slug: l.slug, titulo: typeof l.titulo === "string" && l.titulo ? l.titulo : l.slug, quando: l.created_at,
  }));
}

export async function GET(request: Request) {
  const resolvido = await autenticacaoDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { supabase, workspaceId } = resolvido.contexto;
  const filtros = lerFiltros(new URL(request.url).searchParams);

  if (filtros.aba === "perguntas") {
    // Decisão de 28/09: depois. Ver `lib/registros/registros.ts`.
    return NextResponse.json({ linhas: [], proximo: null });
  }

  const marcas = await nomesDasMarcas(supabase, workspaceId);
  const linhas = filtros.aba === "acessos"
    ? await acessos(supabase, workspaceId, filtros, marcas)
    : filtros.aba === "acoes"
      ? await acoes(supabase, workspaceId, filtros, marcas)
      : await downloads(supabase, workspaceId, filtros, marcas);

  if (linhas === null) {
    return NextResponse.json(
      { message: isEnglish ? "Couldn't load the records." : "Não foi possível carregar os registros." },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { linhas, proximo: proximoCursor(linhas) },
    // Registro é informação de administração: nada de cache compartilhado.
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
