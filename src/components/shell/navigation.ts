import type { BrandvilleUtilityKey } from "../../brandville/types";
import type { ProductLocale } from "../../platform/locale";
import { can, type BrandCapability } from "../../platform/capabilities";

export interface ShellDestination {
  href: string;
  label: string;
  /** Capacidade necessária para o destino existir. Ausente = basta consultar. */
  requires?: BrandCapability;
  /** Aparece na navegação inferior do mobile. */
  mobile?: boolean;
  /**
   * O destino é da CONTA, não da marca: `/w/<conta>/...` em vez de
   * `/w/<conta>/b/<marca>/docs/...`. Importar é o caso — o ato cria a marca,
   * então exigir uma marca na URL tornaria a primeira importação inalcançável.
   */
  foraDaMarca?: boolean;
}

export interface ShellSection {
  id: string;
  label: string;
  destinations: ShellDestination[];
}

/**
 * O catálogo das funcionalidades é da PLATAFORMA: rota e rótulo são do
 * produto, e o rótulo fala o idioma da interface.
 *
 * Quais delas existem é da MARCA. Uma conta pode ter contratado o assistente e
 * não a análise de peças, e essa escolha é da instalação, não do produto.
 *
 * A seleção vinha de `brandvilleUtilityLinks`, que lia a instância global — e
 * a instância global é `unconfigured`, com zero utilidades. A seção
 * "Inteligência" ficava permanentemente vazia, e a promoção da V2 levou esse
 * fio junto.
 */
const CATALOGO_DE_UTILIDADES: Record<
  BrandvilleUtilityKey,
  { href: string; pt: string; en: string }
> = {
  chat: { href: "/docs/chat", pt: "Chat da marca", en: "Brand assistant" },
  analysis: { href: "/docs/analise", pt: "Análise de aplicações", en: "Application review" },
  history: { href: "/docs/historico", pt: "Histórico e calibração", en: "History & calibration" },
  "ai-settings": {
    href: "/docs/configuracoes/ia",
    // Curto o bastante para caber na coluna. O rótulo anterior —
    // "Configurações — Conecte sua IA" — era cortado no meio pela largura da
    // barra, e um destino cujo nome não cabe é um destino que não se lê.
    pt: "Provedores de IA",
    en: "AI providers",
  },
};



/**
 * Fonte única dos destinos globais, separada da apresentação.
 *
 * A V1 montava esta lista dentro do componente de navegação, misturada com
 * estado de UI. Aqui ela é dado: o shell V2 e o mobile leem o mesmo módulo, e
 * a permissão é decidida antes de renderizar — um member nunca recebe link
 * que terminaria em 403.
 */
export function shellSections({
  capabilities,
  locale,
  utilityLinks = [],
}: {
  capabilities: readonly BrandCapability[];
  /** Idioma da INTERFACE. Os destinos da moldura são do produto; o manual pode
   *  estar em outra língua sem que a navegação mude. */
  locale: ProductLocale;
  /** As funcionalidades desta MARCA, vindas da requisição. Ausente = nenhuma,
   *  que é o estado de quem ainda não tem marca. */
  utilityLinks?: readonly BrandvilleUtilityKey[];
}): ShellSection[] {
  const t = (pt: string, en: string) => (locale === "en" ? en : pt);
  const utilities = utilityLinks
    .map((chave) => CATALOGO_DE_UTILIDADES[chave])
    .filter(Boolean)
    .map((item) => ({ href: item.href, label: locale === "en" ? item.en : item.pt }));

  /*
   * O manual primeiro.
   *
   * A ordem anterior punha oito destinos de produto acima do conteúdo: Visão
   * geral, Biblioteca, quatro de Inteligência, Importar e Administração — e só
   * então as páginas do manual. Num produto cujo trabalho é consultar o
   * manual, o manual estava no fim da lista.
   *
   * As áreas agora respondem a "o que estou fazendo":
   *
   *   Manual      o conteúdo, e a visão geral que leva a ele
   *   Consultar   as ferramentas que se usa LENDO — perguntar e avaliar peça
   *   Acervo      o que se busca de vez em quando: assets e histórico
   *   Conta       o que é do WORKSPACE e não da marca
   *
   * "Conta" não é cosmética: `ai_settings` é por workspace, e importar cria
   * marca — nenhuma das duas pertence à marca aberta. Deixá-las na hierarquia
   * dela sugeria que configurar IA fosse configurar aquela marca.
   */
  const porChave = (chave: BrandvilleUtilityKey) =>
    utilities.filter((u) => u.href === CATALOGO_DE_UTILIDADES[chave].href);

  const sections: ShellSection[] = [
    {
      id: "manual",
      label: t("Manual", "Manual"),
      destinations: [{ href: "/docs", label: t("Visão geral", "Overview"), mobile: true }],
    },
    {
      id: "consultar",
      label: t("Consultar", "Consult"),
      destinations: [...porChave("chat"), ...porChave("analysis")],
    },
    {
      id: "library",
      label: t("Acervo", "Library"),
      destinations: [
        { href: "/docs/biblioteca", label: t("Biblioteca de assets", "Asset library"), mobile: true },
        ...porChave("history"),
      ],
    },
    {
      id: "account",
      label: t("Conta", "Account"),
      destinations: [
        { href: "/docs/importar", label: t("Importar manual", "Import a manual"), requires: "administrar", foraDaMarca: true },
        { href: "/docs/admin", label: t("Administração", "Administration"), requires: "administrar" },
        ...porChave("ai-settings").map((d) => ({ ...d, requires: "administrar" as const })),
      ],
    },
  ];

  return sections
    .map((section) => ({
      ...section,
      // O destino não existe quando falta a capacidade. Não é botão desabilitado:
      // quem consulta não vê sinal de que há uma superfície de edição.
      destinations: section.destinations.filter((d) => can(capabilities, d.requires ?? "consultar")),
    }))
    .filter((section) => section.destinations.length > 0);
}

/**
 * Ativo considerando rotas filhas: /docs/historico/42 acende /docs/historico.
 *
 * Recebe o prefixo porque os destinos são canônicos (`/docs/...`) e a URL real
 * carrega o contexto (`/w/<conta>/b/<marca>/docs/...`). Comparar os dois sem
 * traduzir deixava a navegação inteira apagada dentro do contexto — nenhum
 * destino casava, e quem navega perdia a referência de onde está.
 */
export function isDestinationActive(
  href: string,
  pathname: string,
  basePath?: string,
  foraDaMarca?: boolean,
): boolean {
  const alvo = withBase(href, basePath, foraDaMarca);
  const raiz = withBase("/docs", basePath);
  if (alvo === raiz) return pathname === raiz || !pathname.startsWith(`${raiz}/`);
  return pathname === alvo || pathname.startsWith(`${alvo}/`);
}

/**
 * Reescreve um destino para outro prefixo. Sem prefixo, devolve o original.
 *
 * Destinos marcados `foraDaMarca` param na conta: de
 * `/w/x/b/y/docs` sobra `/w/x`, e o resto do caminho é acrescentado ali.
 */
export function withBase(href: string, basePath?: string, foraDaMarca?: boolean): string {
  if (!basePath) return href;
  if (!foraDaMarca) return href.replace(/^\/docs/, basePath);
  const conta = basePath.replace(/\/b\/[^/]+\/docs$/, "");
  return href.replace(/^\/docs/, conta);
}
