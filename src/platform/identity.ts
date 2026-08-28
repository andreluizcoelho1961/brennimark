/**
 * Identidade da plataforma — o produto que hospeda os manuais, distinta da
 * marca de cada cliente.
 *
 * `Brandville` é CODINOME TÉCNICO, não nome comercial: o briefing §2.3 proíbe
 * consolidá-lo em interface, venda, domínio ou contrato, e o nome definitivo é
 * decisão humana pendente (§24). Enquanto não existir, `displayName` carrega o
 * rótulo provisório e é o único lugar a mudar quando a marca for definida.
 */
export const platformIdentity = {
  /** Nome exibido na interface. Trocar aqui renomeia o produto inteiro. */
  displayName: "Brandville",
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
  background: "#14161a",
  backgroundSecondary: "#0f1115",
  surface: "#1b1e24",
  surfaceLight: "#242830",
  foreground: "#f4f5f7",
  muted: "#9099a8",
  accent: "#7c8aa0",
  accentSecondary: "#5d6b80",
  border: "#2b3038",
  focus: "#a8b4c6",
} as const;
