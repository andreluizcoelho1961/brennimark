import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { parseBrandRow, parseDocumentRow, type ActiveBrand } from "./brand-row";
import type { DocPageEntry, DocPageImage } from "@/content/docs";
import { createClient } from "@/lib/supabase/server";
import { BRAND_CAPABILITIES, type BrandCapability } from "@/platform/capabilities";
import {
  resolverWorkspace,
  type ResolucaoDeWorkspace,
  type WorkspaceDisponivel,
} from "./selecao";

const SKIP_AUTH = process.env.BRENNIMARK_DEV_SKIP_AUTH === "true";

export type BrandvilleAuthContext = {
  supabase: SupabaseClient;
  user: User;
  workspaceId: string;
  /** O slug do workspace resolvido. Quem monta URL não precisa consultar. */
  workspaceSlug: string;
  role: "owner" | "member";
};

/**
 * Sessão, workspace e papel — uma vez por requisição.
 *
 * `cache` do React memoriza por requisição, não por processo. Sem ele, cada
 * rota que precisasse do cliente Supabase abriria outra chamada à Auth API,
 * que é justamente a duplicação que o patch 1.1 removeu do layout.
 */
export const getBrandvilleAuthContext = cache(
  async (workspaceSlug?: string): Promise<BrandvilleAuthContext | null> => {
    if (SKIP_AUTH) return null;

    const resolucao = await resolverWorkspaceAtivo(workspaceSlug);
    if (resolucao.tipo !== "workspace") return null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    return {
      supabase,
      user,
      workspaceId: resolucao.workspace.id,
      workspaceSlug: resolucao.workspace.slug,
      role: resolucao.workspace.papel,
    };
  },
);

/**
 * O workspace desta requisição, pela regra e não pela ordem de inserção.
 *
 * O `.limit(1)` que estava aqui respondia "o primeiro workspace" para quem
 * participa de dois. Não era uma escolha errada — era a ausência de escolha,
 * disfarçada de resposta. Agora: com slug, resolve aquele e confere
 * participação; sem slug, resolve se houver exatamente um e RECUSA se houver
 * mais, em vez de sortear.
 */
export const resolverWorkspaceAtivo = cache(
  async (workspaceSlug?: string): Promise<ResolucaoDeWorkspace> => {
    const disponiveis = await listarDisponiveis();
    if (disponiveis === null) return { tipo: "anonimo" };

    const perfilOk = await temPerfilCompleto();
    return resolverWorkspace(
      { temSessao: true, cadastroCompleto: perfilOk, disponiveis },
      workspaceSlug,
    );
  },
);

/**
 * Nome no perfil — o segundo dos dois casos de onboarding.
 *
 * Separado de getProfileSummary porque a resolução de workspace precisa dele
 * antes de existir um contexto de autenticação para passar adiante.
 */
export const temPerfilCompleto = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return typeof data?.full_name === "string" && data.full_name.length > 0;
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

const COLUNAS_DA_MARCA =
  "id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal, status_labels";

/**
 * Tudo a que esta pessoa tem acesso — workspaces e as marcas de cada um.
 *
 * Uma consulta, sem `.limit(1)`. O limite era o defeito: ele transformava "a
 * pessoa participa de dois workspaces" em "a pessoa participa de um", e a
 * escolha de qual era a ordem de inserção. Aqui a lista vem inteira e quem
 * decide é a regra em selecao.ts, que sabe perguntar quando há mais de uma.
 *
 * A RLS já devolve só o que a associação permite. A regra confere de novo, com
 * a mesma lista: duas consultas separadas — uma para autorizar, outra para
 * carregar — são duas chances de divergir, e divergir aqui é servir o conteúdo
 * de um cliente sob a URL de outro.
 *
 * Ordem estável por nome e depois por id. O desempate por id não é decoração:
 * dois workspaces de mesmo nome trocariam de posição entre requisições, e o
 * seletor mudaria de lugar debaixo do cursor de quem está clicando.
 */
export const listarDisponiveis = cache(async (): Promise<readonly WorkspaceDisponivel[] | null> => {
  if (SKIP_AUTH) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, slug, name, brands(id, key, name))")
    .eq("user_id", user.id);
  if (error) throw error;

  const porNome = <T extends { nome: string; id: string }>(a: T, b: T) =>
    a.nome.localeCompare(b.nome) || a.id.localeCompare(b.id);

  return (data ?? [])
    .flatMap((linha) => {
      const w = linha.workspaces as unknown as
        | { id: string; slug: string; name: string; brands: { id: string; key: string; name: string }[] }
        | null;
      const papel = linha.role;
      if (!w?.id || !w.slug || (papel !== "owner" && papel !== "member")) return [];
      return [{
        id: w.id,
        slug: w.slug,
        nome: w.name ?? w.slug,
        papel,
        marcas: (w.brands ?? [])
          .map((m) => ({ id: m.id, key: m.key, nome: m.name ?? m.key }))
          .sort(porNome),
      } satisfies WorkspaceDisponivel];
    })
    .sort(porNome);
});

/**
 * A marca resolvida, por identificador.
 *
 * Recebe o id que a regra já validou, e filtra TAMBÉM por workspace. O filtro
 * duplo é de propósito: um id de marca de outro workspace, chegando por
 * qualquer caminho, não encontra linha em vez de encontrar a marca errada. A
 * RLS impediria o vazamento entre contas; ela não impede a confusão entre dois
 * workspaces da mesma pessoa.
 */
export async function carregarMarca(
  auth: BrandvilleAuthContext,
  brandId: string,
): Promise<ActiveBrand | null> {
  const { data, error } = await auth.supabase
    .from("brands")
    .select(COLUNAS_DA_MARCA)
    .eq("id", brandId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  if (error) throw error;
  return parseBrandRow(data);
}

/**
 * As capacidades da pessoa NESTA marca.
 *
 * Substitui `capabilitiesForRole(papel da conta)`, que dava as mesmas quatro
 * capacidades em toda marca da conta a quem fosse `owner`. Desde a migration
 * `20260913223226_acesso_por_marca`, quem decide é `brand_members` — e a
 * decisão é por marca, que é como o André pediu em 13/09: "escolher se tem
 * acesso a uma marca, a duas, a todas, e quais".
 *
 * A RLS já impede ler a linha de outra pessoa, então esta consulta não precisa
 * filtrar por `user_id`: o banco filtra. Sem linha, sem capacidade — e a
 * moldura simplesmente não oferece o que a pessoa não pode fazer. Continua
 * valendo o ADR-0002 §4: isto decide o que APARECE; o que é PERMITIDO é a RLS.
 */
export async function capacidadesNaMarca(
  auth: BrandvilleAuthContext,
  brandId: string,
): Promise<BrandCapability[]> {
  const { data, error } = await auth.supabase
    .from("brand_members")
    .select("capacidades")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) throw error;
  const cruas = (data?.capacidades ?? []) as string[];
  // Filtra pelo vocabulário conhecido: uma capacidade futura gravada no banco
  // por uma versão mais nova não pode virar `undefined` dentro da interface.
  return BRAND_CAPABILITIES.filter((c) => cruas.includes(c));
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
  const entradas = (data ?? []).map(parseDocumentRow).filter((entry): entry is DocPageEntry => entry !== null);
  return resolverImagensDeStorage(auth.supabase, entradas);
}

/**
 * Troca caminho de Storage por URL assinada, uma vez por requisição.
 *
 * Fase 1g: `DocPageImage.src` foi desenhado para caminho estático de
 * `/public` (sempre começa com `/`); a imagem de página inteira que o
 * importador agora envia usa o mesmo padrão de pasta de todo outro asset
 * da marca (`workspaceId/brandId/...`, sem barra inicial) — esse é o sinal
 * que distingue os dois. `DocPage`/`BrandCanvas` são Server Components,
 * então a URL nasce fresca a cada render; não há cache de URL para expirar.
 *
 * Uma imagem cuja URL falha ao assinar é DESCARTADA, não mostrada quebrada
 * — mesma regra de "dado malformado nunca vira conteúdo aprovado" que
 * `parseDocumentRow` já aplica à linha inteira (ver brand-row.ts). Isto
 * nunca lança: uma falha ao assinar não pode derrubar o manual inteiro por
 * causa de uma imagem.
 */
async function resolverImagensDeStorage(
  supabase: SupabaseClient,
  entradas: DocPageEntry[],
): Promise<DocPageEntry[]> {
  const caminhos = new Set<string>();
  for (const entrada of entradas) {
    for (const imagem of entrada.images ?? []) {
      if (!imagem.src.startsWith("/")) caminhos.add(imagem.src);
    }
  }
  if (caminhos.size === 0) return entradas;

  const { data } = await supabase.storage
    .from("brand-assets")
    .createSignedUrls([...caminhos], 3_600);

  const urlPorCaminho = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urlPorCaminho.set(item.path, item.signedUrl);
  }

  return entradas.map((entrada) => {
    if (!entrada.images?.length) return entrada;
    const images = entrada.images
      .map((imagem) => (imagem.src.startsWith("/") ? imagem : { ...imagem, src: urlPorCaminho.get(imagem.src) ?? "" }))
      .filter((imagem) => imagem.src.length > 0);
    if (images.length === entrada.images.length) return { ...entrada, images };
    return { ...entrada, images: images.length ? images : undefined };
  });
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
