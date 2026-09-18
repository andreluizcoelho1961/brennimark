import type { DocPageEntry } from "../../content/docs";
import {
  capabilitiesForRole,
  type BrandCapability,
  type WorkspaceRole,
} from "../../platform/capabilities";
import { resolveInterfaceLocale, type ProductLocale } from "../../platform/locale";
import type { ActiveBrand } from "./brand-row";
import type { BrandPromptContext } from "../ai/brand-context";
import type { WorkspaceDisponivel } from "./selecao";

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
 * `development-preview` é o modo local com BRENNIMARK_DEV_SKIP_AUTH: existe
 * como valor nomeado justamente para não virar uma regra de autorização
 * disfarçada. Ele dispensa o redirecionamento e nada mais — as capacidades
 * continuam vazias, como para qualquer visitante sem papel.
 *
 * `onboarding` cobre DOIS casos que pareciam um só, e confundi-los prendia o
 * primeiro usuário do produto num laço: quem tem sessão mas ainda não tem
 * conta (workspace), e quem tem conta mas não completou o perfil. Os dois
 * precisam do cadastro; nenhum dos dois é visitante.
 */
/**
 * `not-found` cobre três causas com uma resposta só — endereço inexistente,
 * workspace do qual a pessoa não participa, marca que não é daquele workspace.
 * Distingui-las confirmaria para quem sonda que o endereço é real.
 *
 * `ambiguous` é o estado que não existia e cuja ausência era o defeito: mais de
 * uma marca alcançável e nenhuma escolhida. Antes isso virava "a primeira".
 */
export type AccessState =
  | "anonymous"
  /**
   * Entrou, e não tem acesso a nada — estado que nasceu em 17/09/2026, com a
   * conta de time. Antes era impossível: todo perfil novo ganhava uma conta.
   * É diferente de `onboarding` (falta preencher o perfil) e de `anonymous`
   * (não entrou). Confundi-lo com `onboarding` fecha um laço: o cadastro não
   * cria mais conta, então a pessoa voltaria para o cadastro para sempre.
   */
  | "sem-acesso"
  | "onboarding"
  | "ready"
  | "development-preview"
  | "not-found"
  | "ambiguous";

export interface WorkspaceContext {
  access: AccessState;
  /** O workspace resolvido. Nulo enquanto não houver um só candidato. */
  workspaceSlug: string | null;
  /**
   * Tudo que a pessoa alcança. Preenchido quando `access` é `ambiguous`, para
   * o seletor perguntar sem consultar o banco de novo.
   */
  opcoes: readonly WorkspaceDisponivel[];
  /** Nulo quando não há sessão, ou quando a conta ainda não tem marca. */
  brand: ActiveBrand | null;
  docs: readonly DocPageEntry[];
  capabilities: readonly BrandCapability[];
  userEmail?: string;
  /** Slug de entrada da marca, ou nulo quando ela não declara um. */
  defaultDocSlug: string | null;
  /**
   * Idioma da INTERFACE, não do manual. Um manual em inglês não muda o login.
   * Resolvido em platform/locale.ts, que é onde a preferência da pessoa entra
   * quando houver onde guardá-la.
   */
  locale: ProductLocale;
}

export interface AuthShape {
  role: WorkspaceRole;
  email?: string;
}

export function montarContexto({
  access,
  auth,
  marca,
  docs,
  workspaceSlug = null,
  opcoes = [],
  capacidades,
}: {
  access: AccessState;
  auth: AuthShape | null;
  marca: ActiveBrand | null;
  docs: readonly DocPageEntry[];
  workspaceSlug?: string | null;
  opcoes?: readonly WorkspaceDisponivel[];
  /**
   * As capacidades NESTA marca, lidas de `brand_members`. Quando ausentes —
   * onboarding, visitante, preview local, nenhum dos quais tem marca aberta —
   * a derivação pelo papel da conta continua valendo, e devolve vazio sem
   * papel.
   */
  capacidades?: readonly BrandCapability[];
}): WorkspaceContext {
  const slug = marca?.navigation.defaultDocSlug;
  return {
    access,
    workspaceSlug,
    opcoes,
    brand: marca,
    docs,
    /*
     * Por marca, quando há marca.
     *
     * Até 13/09/2026 esta linha era só `capabilitiesForRole(auth?.role)` — o
     * papel na CONTA. Quem fosse `owner` administrava toda marca da conta, e
     * quem fosse `member` só consultava, mesmo sendo a pessoa responsável por
     * editar uma delas. Agora quem responde é `brand_members`, por marca.
     *
     * O caminho sem marca mantém a regra antiga, e o contrato dela: sem papel,
     * sem capacidade — um `?? "member"` aqui daria `consultar` a quem não tem
     * sessão.
     */
    capabilities: capacidades ?? capabilitiesForRole(auth?.role),
    userEmail: auth?.email || undefined,
    // Slug vazio redirecionaria para /docs/ e produziria laço.
    defaultDocSlug: slug ? slug : null,
    // Sem argumento, de propósito e por enquanto: não existe preferência de
    // idioma guardada em lugar nenhum. Quando existir, ela entra AQUI — e
    // vários módulos que hoje leem PRODUCT_LOCALE direto terão de passar a
    // receber este valor. Ver a dívida descrita em platform/locale.ts.
    locale: resolveInterfaceLocale(),
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
  /**
   * Existe sessão? Diferente de `getAuth`, que devolve null tanto para quem
   * não entrou quanto para quem entrou e ainda não tem conta. Tratar os dois
   * como visitante mandava a segunda pessoa para o login, e o login — vendo
   * que ela tem sessão — mandava de volta. Laço fechado, cadastro inalcançável.
   */
  temSessao: () => Promise<boolean>;
  getAuth: () => Promise<A | null>;
  getProfile: (auth: A) => Promise<{ fullName: string } | null>;
  getActiveBrand: (auth: A) => Promise<ActiveBrand | null>;
  getDocsByBrandId: (auth: A, brandId: string) => Promise<readonly DocPageEntry[]>;
  /**
   * As capacidades desta pessoa na marca aberta. Opcional para os chamadores
   * que não têm banco (testes, preview local): sem ela, a derivação pelo papel
   * da conta continua respondendo.
   */
  getCapacidades?: (auth: A, brandId: string) => Promise<readonly BrandCapability[]>;
  /** Verdadeiro apenas no preview local. Decisão da camada de servidor. */
  devPreview?: boolean;
  /** Já resolvido pelo adaptador; entra no contexto para quem monta URL. */
  workspaceSlug?: string | null;
  /**
   * Tudo que a pessoa alcança, TAMBÉM no caminho pronto.
   *
   * Antes só chegava nos estados ambíguos, e a consequência aparecia na barra:
   * o seletor procurava a marca aberta nesta lista, não a encontrava, e caía
   * no identificador da URL. A moldura mostrava `ge-id000` em vez de
   * `GE_ID000` — o slug, que é endereço, ocupando o lugar do nome, que é
   * identidade.
   */
  opcoes?: readonly WorkspaceDisponivel[];
}): Promise<WorkspaceContext> {
  const auth = await deps.getAuth();

  if (!auth) {
    const comSessao = deps.devPreview ? false : await deps.temSessao();
    return montarContexto({
      access: deps.devPreview
        ? "development-preview"
        : comSessao
          ? "onboarding"
          : "anonymous",
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

  // Documentos e capacidades dependem os dois só do id da marca, e nenhum do
  // outro: vão juntos, não em fila.
  const [docs, capacidades] = marca
    ? await Promise.all([
        deps.getDocsByBrandId(auth, marca.id),
        deps.getCapacidades?.(auth, marca.id),
      ])
    : [[] as readonly DocPageEntry[], undefined];

  return montarContexto({
    access: "ready", auth, marca, docs, capacidades,
    workspaceSlug: deps.workspaceSlug ?? null,
    opcoes: deps.opcoes ?? [],
  });
}

/**
 * O recorte da marca que o assistente enxerga.
 *
 * Uma função, e não um objeto montado em cada rota: se cada chamador escolhesse
 * os campos, um deles acabaria esquecendo o papel ou o idioma e caindo em um
 * padrão — que foi exatamente como a instância global sobreviveu até aqui.
 */
export function brandPromptContext(marca: ActiveBrand): BrandPromptContext {
  return {
    language: marca.metadata.language,
    chatRole: marca.ai.chatRole,
    analysisRole: marca.ai.analysisRole,
    // Esquecer esta linha não quebrava nada: o campo é opcional, e o prompt
    // caía nos rótulos do produto sem avisar. A tela mostrava "Documentado" e
    // o assistente citava "PRONTO" — o defeito que o patch 3.2 corrigiu,
    // sobrevivendo no adaptador porque os testes montavam o contexto à mão.
    statusLabels: marca.statusLabels,
  };
}
