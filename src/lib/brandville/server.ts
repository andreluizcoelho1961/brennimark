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
