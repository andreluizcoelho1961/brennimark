/**
 * A coluna da PLATAFORMA — o que ela mostra, decidido como dado.
 *
 * Plano da interface (docs/plan/PLANO-DA-INTERFACE.md §2): a coluna da
 * esquerda é da plataforma, e a barra de cima é do conteúdo da marca. Manual e
 * Materiais NÃO estão aqui: moram no segmentado da barra de cima.
 *
 * Três grupos, e a regra de cada um:
 *
 *   plataforma  Marcas — sempre, para todos. É a tela inicial.
 *   gestão      só para quem ADMINISTRA a conta em contexto. O que ainda não
 *               existe aparece apagado, com "em breve" (decisão de 18/09):
 *               a pessoa vê o que o produto vai ter, sem clicar numa tela vazia.
 *   marca       só com marca aberta, e só o que a capacidade dela permite.
 *               É provisório: chat, análise e histórico vão para a janela do
 *               Vini (fatia 4); provedores de IA para Configurações. Até lá,
 *               ficam aqui — nada some antes de ter para onde ir.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type IconeDaColuna =
  | "manual" | "materiais"
  | "marcas" | "pessoas" | "links" | "registros" | "configuracoes"
  | "assistente" | "analise" | "historico" | "importar" | "administracao" | "ia";

export interface ItemDaColuna {
  id: string;
  rotulo: string;
  icone: IconeDaColuna;
  /** Ausente quando `emBreve`: não se oferece link para tela que não existe. */
  href?: string;
  emBreve?: boolean;
  /** Acende também em rotas filhas. Marcas acende só no endereço exato. */
  exato?: boolean;
}

export interface GrupoDaColuna {
  id: "conteudo" | "plataforma" | "gestao" | "marca";
  rotulo: string;
  itens: ItemDaColuna[];
}

/** Um destino da marca, como a navegação atual o descreve. */
export interface DestinoDaMarca {
  href: string;
  label: string;
}

/**
 * Os destinos da marca que VIVEM na barra de cima, e por isso saem da coluna.
 *
 * Reconhecidos pelo SEGMENTO do endereço (`original`, `biblioteca`), e não por
 * um trecho como `/docs/original`: o prefixo muda — `/w/<conta>/b/<marca>/docs`
 * em produção, `/dev/marcas` na bancada — e o segmento não. A primeira versão
 * casava pelo trecho e só funcionava em produção por coincidência de formato;
 * a captura da bancada mostrou o manual repetido na coluna (18/09).
 */
const NA_BARRA_DE_CIMA = ["original", "biblioteca"];

const ICONE_POR_SEGMENTO: [string, IconeDaColuna][] = [
  ["chat", "assistente"],
  ["analise", "analise"],
  ["historico", "historico"],
  ["importar", "importar"],
  ["admin", "administracao"],
  ["configuracoes", "ia"],
];

function segmentos(href: string): string[] {
  return href.split(/[?#]/)[0].split("/").filter(Boolean);
}

function temSegmento(href: string, segmento: string): boolean {
  return segmentos(href).includes(segmento);
}

function iconeDoDestino(href: string): IconeDaColuna {
  return ICONE_POR_SEGMENTO.find(([segmento]) => temSegmento(href, segmento))?.[1] ?? "administracao";
}

export function colunaDaPlataforma({
  contaSlug,
  administraConta,
  marca,
  ingles = false,
}: {
  /** A conta em contexto. Ausente quando a pessoa está em várias e nenhuma
   *  foi escolhida — aí a gestão não aparece, porque não há de qual conta. */
  contaSlug?: string;
  administraConta: boolean;
  /** Presente só com uma marca aberta: os destinos já filtrados pela
   *  capacidade e já com o endereço real (com o prefixo da marca). */
  marca?: { destinos: readonly DestinoDaMarca[] };
  ingles?: boolean;
}): GrupoDaColuna[] {
  const t = (pt: string, en: string) => (ingles ? en : pt);
  const inicio = contaSlug ? `/w/${contaSlug}` : "/docs";

  const grupos: GrupoDaColuna[] = [
    {
      id: "plataforma",
      rotulo: t("Plataforma", "Platform"),
      itens: [{ id: "marcas", rotulo: t("Marcas", "Brands"), icone: "marcas", href: inicio, exato: true }],
    },
  ];

  if (contaSlug && administraConta) {
    grupos.push({
      id: "gestao",
      rotulo: t("Gestão", "Management"),
      itens: [
        { id: "pessoas", rotulo: t("Pessoas e acesso", "People & access"), icone: "pessoas", href: `/w/${contaSlug}/pessoas` },
        { id: "links", rotulo: t("Links de entrega", "Delivery links"), icone: "links", emBreve: true },
        { id: "registros", rotulo: t("Registros", "Records"), icone: "registros", emBreve: true },
        { id: "configuracoes", rotulo: t("Configurações", "Settings"), icone: "configuracoes", emBreve: true },
      ],
    });
  }

  if (marca) {
    const itens = marca.destinos
      .filter((d) => !NA_BARRA_DE_CIMA.includes(segmentos(d.href).at(-1) ?? ""))
      // Importar é criar marca: o gesto mora na tela Marcas ("+ Nova marca"),
      // não dentro de uma marca já aberta.
      .filter((d) => !temSegmento(d.href, "importar"))
      .map((d) => ({ id: d.href, rotulo: d.label, icone: iconeDoDestino(d.href), href: d.href }));
    if (itens.length > 0) grupos.push({ id: "marca", rotulo: t("Nesta marca", "In this brand"), itens });
  }

  return grupos;
}

/** O item acende no seu endereço — e, se não for `exato`, nas rotas filhas. */
export function itemAtivo(item: ItemDaColuna, pathname: string): boolean {
  if (!item.href) return false;
  if (item.exato) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Os endereços do segmentado da barra de cima para a marca aberta.
 *
 * Sem marca, não há endereço: o segmentado aparece APAGADO (decisão de 18/09,
 * "como o Illustrator sem documento aberto"), e não como link morto.
 */
export function segmentadoDaMarca(basePath?: string): {
  manual?: string; materiais?: string;
} {
  if (!basePath) return {};
  return { manual: `${basePath}/original`, materiais: `${basePath}/biblioteca` };
}

/**
 * Os grupos da GAVETA do celular: a coluna, mais o conteúdo da marca aberta.
 *
 * No desktop, Manual e Materiais moram no segmentado da barra de cima. No
 * celular essa barra não cabe e fica escondida — e sem este grupo o manual
 * ficava INALCANÇÁVEL no telefone. Foi a suíte de navegador que mostrou, na
 * própria fatia da moldura (18/09).
 */
export function gruposDaGaveta(
  coluna: readonly GrupoDaColuna[],
  segmentado: { manual?: string; materiais?: string } | undefined,
  ingles = false,
): GrupoDaColuna[] {
  if (!segmentado?.manual) return [...coluna];
  const itens: ItemDaColuna[] = [
    { id: "manual", rotulo: "Manual", icone: "manual", href: segmentado.manual },
  ];
  if (segmentado.materiais) {
    itens.push({ id: "materiais", rotulo: ingles ? "Materials" : "Materiais", icone: "materiais", href: segmentado.materiais });
  }
  return [{ id: "conteudo", rotulo: ingles ? "Brand content" : "Conteúdo da marca", itens }, ...coluna];
}
