/**
 * Identidade da plataforma — o produto que hospeda os manuais, distinta da
 * marca de cada cliente.
 *
 * `Brennimark` — islandês para a marca queimada, a origem literal da palavra
 * "brand". Candidato número um, verificado como livre, adotado como nome de
 * trabalho. Segue marcado como provisório até a decisão final; a troca continua
 * sendo uma linha.
 *
 * `Brandville` era codinome técnico legado e não pode voltar a aparecer em
 * interface, venda, domínio ou contrato.
 */
export const platformIdentity = {
  /** Nome exibido na interface. Trocar aqui renomeia o produto inteiro. */
  displayName: "Brennimark",
  /** Verdadeiro enquanto o nome for provisório. A interface pode sinalizar. */
  isProvisionalName: true,
} as const;

/**
 * Paleta da moldura do produto: login, navegação, administração, configurações
 * e rodapé. Deliberadamente neutra e distinta de qualquer marca cliente, para
 * que o cliente perceba que existe um produto por trás do manual dele.
 *
 * PROVISÓRIA. Não é identidade visual aprovada — é um lugar de encaixe. Quando
 * a marca do aplicativo existir, os valores trocam aqui e em mais nenhum lugar.
 */
export const platformTheme = {
  /** Pilha tipográfica da interface. Vive em globals.css (--font-ui); repetida
   *  aqui só como documentação de que a plataforma tem fonte própria e não
   *  herda a da marca consultada. */
  uiFontNote: "system-ui — provisória, ver --font-ui em globals.css",

  bg: "#14161a",
  panel: "#1b1e24",
  panelMuted: "#242830",
  text: "#f4f5f7",
  textMuted: "#9099a8",
  border: "#2b3038",

  /**
   * Sinal de localização e ação. ACROMÁTICO nesta fase, por decisão: o produto
   * ainda não tem identidade aprovada, e consolidar uma cor proprietária agora
   * criaria relação com todas as marcas que a moldura precisa emoldurar.
   * O contrato do token permanece, para receber cor quando a identidade existir.
   */
  signal: "#f4f5f7",
  signalSoft: "#242830",

  /** Alta visibilidade por acessibilidade. Não é cor de marca do produto. */
  focus: "#ffffff",

  /** Semânticos. Sempre acompanhados de texto ou ícone, nunca só cor. */
  success: "#62c68a",
  warning: "#f0bb52",
  danger: "#ff8a82",
} as const;
