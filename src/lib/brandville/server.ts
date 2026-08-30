import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { parseBrandRow, parseDocumentRow, type ActiveBrand } from "./brand-row";
import type { DocPageEntry, DocPageImage } from "@/content/docs";
import { createClient } from "@/lib/supabase/server";

const SKIP_AUTH = process.env.BRANDVILLE_DEV_SKIP_AUTH === "true";

export type BrandvilleAuthContext = {
  supabase: SupabaseClient;
  user: User;
  workspaceId: string;
  role: "owner" | "member";
};

/**
 * Sessão, workspace e papel — uma vez por requisição.
 *
 * `cache` do React memoriza por requisição, não por processo. Sem ele, cada
 * rota que precisasse do cliente Supabase abriria outra chamada à Auth API,
 * que é justamente a duplicação que o patch 1.1 removeu do layout.
 */
export const getBrandvilleAuthContext = cache(async (): Promise<BrandvilleAuthContext | null> => {
  if (SKIP_AUTH) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.workspace_id || (data.role !== "owner" && data.role !== "member")) return null;
  return { supabase, user, workspaceId: data.workspace_id, role: data.role };
});



/**
 * Só a sessão, sem exigir conta.
 *
 * `getBrandvilleAuthContext` devolve null tanto para quem não entrou quanto
 * para quem entrou e ainda não tem workspace — e essa ambiguidade prendia o
 * primeiro usuário do produto num laço de redirecionamento.
 */
export const temSessao = cache(async (): Promise<boolean> => {
  if (SKIP_AUTH) return false;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
});

export function validImages(value: unknown): value is DocPageImage[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const image = item as Record<string, unknown>;
    return typeof image.src === "string" && typeof image.alt === "string" &&
      (image.caption === undefined || typeof image.caption === "string");
  });
}

/**
 * A marca ativa desta requisição.
 *
 * Enquanto a instância é escolhida por variável de ambiente em build, ela
 * seleciona qual linha carregar. A migração 2 substitui isso por resolução em
 * tempo de execução, e então uma conta poderá servir várias marcas.
 */
export async function resolveActiveBrand(
  context?: BrandvilleAuthContext | null,
): Promise<ActiveBrand | null> {
  const auth = context === undefined ? await getBrandvilleAuthContext() : context;
  if (!auth) return null;

  const chave = process.env.NEXT_PUBLIC_BRANDVILLE_INSTANCE;
  let consulta = auth.supabase
    .from("brands")
    .select("id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal, status_labels")
    .eq("workspace_id", auth.workspaceId);

  if (chave && chave !== "unconfigured") consulta = consulta.eq("key", chave);

  const { data, error } = await consulta.order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;

  return parseBrandRow(data);
}

/**
 * As páginas de UMA marca, direto do banco.
 *
 * Recebe o identificador já resolvido e não descobre marca nenhuma. Antes ela
 * chamava resolveActiveBrand por conta própria, o que fazia a mesma requisição
 * resolver a marca duas vezes — e abria a porta para navegação e conteúdo
 * enxergarem marcas diferentes.
 */
export async function getBrandDocs(
  auth: BrandvilleAuthContext,
  brandId: string,
): Promise<DocPageEntry[]> {
  const { data, error } = await auth.supabase
    .from("brand_documents")
    .select("slug, group_name, title, status, body, images, blocks, sort_order")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  // Linha que não passa na tradução some do manual em vez de aparecer com
  // valor indefinido. Ver o comentário em brand-row.ts.
  return (data ?? []).map(parseDocumentRow).filter((entry): entry is DocPageEntry => entry !== null);
}

/**
 * O perfil, só com o que decide o onboarding.
 *
 * O erro sobe. Engoli-lo faria uma falha de banco ou de RLS devolver `null`, e
 * `null` aqui significa "ainda não completou o cadastro": a pessoa seria
 * mandada para o onboarding por causa de um defeito de infraestrutura, e
 * refaria um cadastro que já existe.
 */
export async function getProfileSummary(
  auth: BrandvilleAuthContext,
): Promise<{ fullName: string } | null> {
  const { data, error } = await auth.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  const nome = data?.full_name;
  return typeof nome === "string" && nome.length > 0 ? { fullName: nome } : null;
}

/**
 * Páginas que foram excluídas e ainda têm histórico.
 *
 * Sem esta lista a recuperação existe na API e não existe na experiência: a
 * página some da seleção no instante da exclusão, e ninguém consegue chegar ao
 * histórico dela — muito menos depois de recarregar a tela.
 *
 * Duas escolhas de consulta que importam:
 *
 * Só linhas `deleted`. Uma página que voltou tem linha viva e é filtrada pelos
 * slugs vivos de qualquer jeito, então nenhuma outra ação responde a esta
 * pergunta. A primeira versão desta função lia TODAS as ações e cortava nas
 * 500 mais recentes — numa marca com histórico longo, uma exclusão antiga
 * ficaria fora da janela e a página seria irrecuperável pela interface.
 *
 * E os slugs vivos entram na própria consulta, não em filtro depois. Assim o
 * banco devolve só o que interessa, e a paginação percorre um conjunto que na
 * prática é pequeno: exclusões são raras.
 */
export async function getDeletedPages(
  auth: BrandvilleAuthContext,
  brandId: string,
  slugsVivos: readonly string[],
): Promise<{ slug: string; title: string; deletedAt: string }[]> {
  const PAGINA = 1000;
  const vistos = new Map<string, { slug: string; title: string; deletedAt: string }>();

  for (let inicio = 0; ; inicio += PAGINA) {
    let consulta = auth.supabase
      .from("brand_document_versions")
      .select("slug, snapshot, created_at")
      .eq("brand_id", brandId)
      .eq("action", "deleted")
      .order("created_at", { ascending: false })
      // Desempate por id: sem ele, duas exclusões no mesmo instante podem sair
      // em ordens diferentes a cada página, e uma linha se repetiria enquanto
      // outra sumiria da paginação.
      .order("id", { ascending: false })
      .range(inicio, inicio + PAGINA - 1);

    if (slugsVivos.length > 0) {
      consulta = consulta.not("slug", "in", `(${slugsVivos.map((s) => `"${s}"`).join(",")})`);
    }

    const { data, error } = await consulta;
    if (error) throw error;

    for (const linha of data ?? []) {
      // A primeira ocorrência é a mais recente: é a exclusão que vale.
      if (vistos.has(linha.slug)) continue;
      const titulo = (linha.snapshot as Record<string, unknown> | null)?.title;
      vistos.set(linha.slug, {
        slug: linha.slug,
        title: typeof titulo === "string" && titulo ? titulo : linha.slug,
        deletedAt: linha.created_at,
      });
    }

    if ((data?.length ?? 0) < PAGINA) break;
  }

  return [...vistos.values()];
}
