import type { DocPageEntry } from "../../content/docs";
import { capabilitiesForRole, type BrandCapability } from "../../platform/capabilities";
import type { ActiveBrand } from "./brand-row";

/**
 * A forma do contexto de requisição, e a regra que o monta.
 *
 * Separado do resolvedor pelo mesmo motivo de brand-row.ts: aqui não há
 * Supabase nem React, então a regra é testável sem banco e sem servidor. O
 * resolvedor que consulta vive em workspace-context.ts.
 */
export interface WorkspaceContext {
  /** Nulo quando não há sessão, ou quando a conta ainda não tem marca. */
  brand: ActiveBrand | null;
  docs: readonly DocPageEntry[];
  capabilities: readonly BrandCapability[];
  userEmail?: string;
  /** Slug de entrada da marca, ou nulo quando ela não declara um. */
  defaultDocSlug: string | null;
  /**
   * Idioma da INTERFACE, não do manual. O produto fala português enquanto a
   * pessoa não escolher outro idioma; um manual em inglês não muda o login.
   * O patch 3 liga a preferência do usuário aqui.
   */
  locale: string;
}

const LOCALE_PADRAO = "pt-BR";

export function montarContexto({
  auth,
  marca,
  docs,
}: {
  auth: { role: "owner" | "member"; email?: string } | null;
  marca: ActiveBrand | null;
  docs: readonly DocPageEntry[];
}): WorkspaceContext {
  const slug = marca?.navigation.defaultDocSlug;
  return {
    brand: marca,
    docs,
    capabilities: capabilitiesForRole(auth?.role ?? "member"),
    userEmail: auth?.email || undefined,
    // Slug vazio redirecionaria para /docs/ e produziria laço.
    defaultDocSlug: slug ? slug : null,
    locale: LOCALE_PADRAO,
  };
}
