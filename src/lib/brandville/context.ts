import type { DocPageEntry } from "../../content/docs";
import {
  capabilitiesForRole,
  type BrandCapability,
  type WorkspaceRole,
} from "../../platform/capabilities";
import type { ActiveBrand } from "./brand-row";

/**
 * A forma do contexto de requisição, a regra que o monta, e o carregador.
 *
 * Sem Supabase e sem React aqui de propósito: as dependências entram por
 * parâmetro, então dá para contar quantas vezes cada uma roda. A afirmação
 * "uma resolução por requisição" precisa ser verificável — no patch 1 ela era
 * comentário, e o comentário estava errado.
 *
 * O adaptador que liga isto ao banco vive em workspace-context.ts.
 */

/**
 * O que o layout precisa saber para decidir para onde mandar a pessoa, sem
 * autenticar por conta própria.
 *
 * `development-preview` é o modo local com BRANDVILLE_DEV_SKIP_AUTH: existe
 * como valor nomeado justamente para não virar uma regra de autorização
 * disfarçada. Ele dispensa o redirecionamento e nada mais — as capacidades
 * continuam vazias, como para qualquer visitante sem papel.
 */
export type AccessState = "anonymous" | "onboarding" | "ready" | "development-preview";

export interface WorkspaceContext {
  access: AccessState;
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

export interface AuthShape {
  role: WorkspaceRole;
  email?: string;
}

const LOCALE_PADRAO = "pt-BR";

export function montarContexto({
  access,
  auth,
  marca,
  docs,
}: {
  access: AccessState;
  auth: AuthShape | null;
  marca: ActiveBrand | null;
  docs: readonly DocPageEntry[];
}): WorkspaceContext {
  const slug = marca?.navigation.defaultDocSlug;
  return {
    access,
    brand: marca,
    docs,
    // Sem papel, sem capacidade. Um `?? "member"` aqui daria `consultar` a
    // quem não tem sessão, contradizendo o contrato de capabilitiesForRole.
    capabilities: capabilitiesForRole(auth?.role),
    userEmail: auth?.email || undefined,
    // Slug vazio redirecionaria para /docs/ e produziria laço.
    defaultDocSlug: slug ? slug : null,
    locale: LOCALE_PADRAO,
  };
}

/**
 * A sequência da requisição, uma vez cada.
 *
 * Perfil e marca não dependem um do outro e começam juntos. Os documentos
 * dependem do identificador da marca e só então são consultados — recebendo o
 * `brandId` que já foi resolvido, em vez de resolvê-lo de novo.
 */
export async function carregarWorkspaceContext<A extends AuthShape>(deps: {
  getAuth: () => Promise<A | null>;
  getProfile: (auth: A) => Promise<{ fullName: string } | null>;
  getActiveBrand: (auth: A) => Promise<ActiveBrand | null>;
  getDocsByBrandId: (auth: A, brandId: string) => Promise<readonly DocPageEntry[]>;
  /** Verdadeiro apenas no preview local. Decisão da camada de servidor. */
  devPreview?: boolean;
}): Promise<WorkspaceContext> {
  const auth = await deps.getAuth();

  if (!auth) {
    return montarContexto({
      access: deps.devPreview ? "development-preview" : "anonymous",
      auth: null,
      marca: null,
      docs: [],
    });
  }

  const [profile, marca] = await Promise.all([deps.getProfile(auth), deps.getActiveBrand(auth)]);

  if (!profile?.fullName) {
    // Perfil incompleto interrompe antes dos documentos: a pessoa vai para o
    // onboarding, e consultar o manual dela seria trabalho jogado fora.
    return montarContexto({ access: "onboarding", auth, marca: null, docs: [] });
  }

  const docs = marca ? await deps.getDocsByBrandId(auth, marca.id) : [];
  return montarContexto({ access: "ready", auth, marca, docs });
}
