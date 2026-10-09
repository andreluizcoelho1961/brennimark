/**
 * Identidade da plataforma — o produto que hospeda os manuais, distinta da
 * marca de cada cliente.
 *
 * `Brennimark` — islandês para a marca queimada, a origem literal da palavra
 * "brand". Candidato número um, verificado como livre, adotado como nome de
 * trabalho. Segue marcado como provisório até a decisão final; a troca continua
 * sendo uma linha.
 *
 * `Brennimark` era codinome técnico legado e não pode voltar a aparecer em
 * interface, venda, domínio ou contrato.
 */
export const platformIdentity = {
  /** Nome exibido na interface. Trocar aqui renomeia o produto inteiro. */
  displayName: "Brennimark",
  /** Descrição do PRODUTO, usada nos metadados da aplicação. Não descreve
   *  nenhuma marca cliente: quem descreve a marca é o manual dela. */
  tagline: "Sistema de gestão de manuais de marca.",
  /** Verdadeiro enquanto o nome for provisório. A interface pode sinalizar. */
  isProvisionalName: true,
} as const;

/**
 * Paleta da moldura do produto: login, navegação, administração, configurações
 * e rodapé. Deliberadamente neutra e distinta de qualquer marca cliente, para
 * que o cliente perceba que existe um produto por trás do manual dele.
 *
 * Fatia 6, 24/09/2026 — decisão do André sobre a folha de tokens: "livro de
 * design de marca dos anos 70" (Vignelli, Aicher, suíço), com calor orgânico.
 * O CLARO ("papel") é o padrão; o ESCURO ("estúdio") é opção de quem usa. A
 * regra do ADR-0004 continua: moldura de museu, acromática, sem cor de
 * destaque — o calor entra pela temperatura dos cinzas, puxados para o papel,
 * e não por uma cor. Contraste de todo texto ≥ 4,5 : 1 nos dois temas
 * (conferido na folha de tokens).
 *
 * 09/10/2026 — MUDOU, decisão do André: a moldura deixa o bege acromático e
 * veste a família azul-acinzentada da marca Brennimark (Gelo, Névoa, Aço,
 * Profundo, Noite Polar), a mesma que o site já usa para mostrar a plataforma
 * (`--app-*` em `site.css`). Continua neutra o bastante para não brigar com a
 * marca do cliente — saturação baixa, nenhum destaque de cor —, e a BRASA
 * (#FF4103) fica SÓ no símbolo do logo, nunca em botão, estado ou foco. A
 * regra de não ter cor de destaque na moldura (ADR-0004) segue de pé; o que
 * mudou foi a temperatura dos neutros, de papel quente para azul-noite.
 *
 * Os valores trocam aqui e em mais nenhum lugar.
 */
/** Os papéis de cor da moldura — os mesmos nos dois temas. */
export type PaletaDaMoldura = {
  bg: string; panel: string; panelMuted: string; text: string; textMuted: string; border: string;
  signal: string; signalSoft: string; focus: string; success: string; warning: string; danger: string;
};

export const platformTheme: PaletaDaMoldura & { uiFontNote: string } = {
  /** Pilha tipográfica da interface. Vive em globals.css (--font-ui): Inter
   *  Tight, grotesca neutra da linhagem Helvetica (escolha do André, 24/09). */
  uiFontNote: "Inter Tight — ver --font-ui em globals.css",

  bg: "#eef2f4",
  panel: "#fafcfd",
  panelMuted: "#e3ebee",
  text: "#001621",
  textMuted: "#465e68",
  border: "#d2dde2",

  /**
   * Sinal de localização e ação. SEM cor de destaque, por decisão: consolidar
   * uma cor proprietária criaria relação com todas as marcas que a moldura
   * emoldura. É o Noite Polar da marca, o mesmo do texto.
   */
  signal: "#001621",
  signalSoft: "#dbe5e9",

  /** Alta visibilidade por acessibilidade. Não é cor de marca do produto. */
  focus: "#001621",

  /** Semânticos. Sempre acompanhados de texto ou ícone, nunca só cor. */
  success: "#39714c",
  warning: "#8c5c0b",
  danger: "#a8453a",
};

/** O tema escuro ("estúdio") — os mesmos papéis: fundo Noite Polar, painel
 *  Profundo, superfície Aço, texto Gelo, texto secundário Névoa. */
export const platformThemeEscuro: PaletaDaMoldura = {
  bg: "#001621",
  panel: "#072631",
  panelMuted: "#0b303c",
  text: "#f2f5f6",
  textMuted: "#b0c3ca",
  border: "#16404d",
  signal: "#f2f5f6",
  signalSoft: "#0e3644",
  focus: "#f2f5f6",
  success: "#7fb88f",
  warning: "#e3b35a",
  danger: "#e08a7a",
};
