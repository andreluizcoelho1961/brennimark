/**
 * O idioma da INTERFACE.
 *
 * A distinção que este módulo existe para manter: o Brennimark tem um idioma,
 * e cada manual tem o seu. Eram a mesma coisa — 33 pontos decidiam a microcópia
 * da plataforma por `brennimarkInstance.metadata.language`, então importar um
 * manual em inglês passava login, navegação, administração e mensagens de erro
 * para o inglês. A pessoa não pediu isso; a marca do cliente dela pediu.
 *
 * O que SEGUE sendo do manual, de propósito:
 * - as respostas do assistente, que citam o manual e devem falar a língua dele;
 * - o vocabulário editorial do selo de status, que a marca pode redefinir.
 *
 * Tudo o mais é instrumento do produto e fala a língua de quem usa.
 */
export const PRODUCT_LOCALES = ["pt-BR", "en"] as const;

export type ProductLocale = (typeof PRODUCT_LOCALES)[number];

/**
 * O padrão do produto enquanto ninguém escolheu.
 *
 * DÍVIDA, descrita como ela é: o que o patch 3 entregou foi o DESACOPLAMENTO
 * do manual — nenhum instrumento do produto decide microcópia por
 * `metadata.language`. Personalização por pessoa é outra coisa, e ainda exige
 * três mudanças além de uma coluna em `profiles`:
 *
 * 1. `resolveInterfaceLocale` precisa receber a preferência; hoje
 *    `WorkspaceContext` a chama sem argumento;
 * 2. os módulos que leem `PRODUCT_LOCALE` diretamente — rotas de API, DocPage,
 *    as mensagens de erro de IA — precisam passar a receber o locale, porque
 *    uma constante de módulo não varia por pessoa;
 * 3. a interface precisa de onde a pessoa escolher.
 *
 * Dizer "basta adicionar a coluna" seria falso.
 */
export const PRODUCT_LOCALE: ProductLocale = "pt-BR";

export function isProductLocale(valor: unknown): valor is ProductLocale {
  return typeof valor === "string" && (PRODUCT_LOCALES as readonly string[]).includes(valor);
}

/**
 * O idioma da interface para esta pessoa.
 *
 * Recebe a preferência do usuário quando ela existir. NÃO recebe o idioma do
 * manual, e essa ausência é o ponto: se o parâmetro existisse, alguém acabaria
 * passando `brand.metadata.language` para cá.
 */
export function resolveInterfaceLocale(preferenciaDoUsuario?: unknown): ProductLocale {
  return isProductLocale(preferenciaDoUsuario) ? preferenciaDoUsuario : PRODUCT_LOCALE;
}

/** Açúcar para a microcópia existente, que é bilíngue por ternário. */
export function inEnglish(locale: ProductLocale): boolean {
  return locale === "en";
}

/**
 * Onde a escolha de idioma fica guardada no navegador. A preferência por
 * pessoa (coluna em `profiles`) chega na fatia da plataforma; o cookie é o que
 * vale para quem ainda não entrou e o que o servidor lê em cada pedido.
 */
export const COOKIE_DE_IDIOMA = "BRENNIMARK_IDIOMA";

/**
 * O idioma que o navegador pede (`Accept-Language`), reduzido aos que o produto
 * tem. Vale só enquanto a pessoa não escolheu: escolha explícita ganha sempre.
 * "pt", "pt-PT" e "pt-BR" viram `pt-BR`; "en", "en-US" e "en-GB" viram `en`.
 */
export function localeDoNavegador(acceptLanguage: string | null | undefined): ProductLocale {
  if (!acceptLanguage) return PRODUCT_LOCALE;
  const pedidos = acceptLanguage
    .split(",")
    .map((parte) => {
      const [tag, ...params] = parte.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const peso = q ? Number(q.slice(2)) : 1;
      return { lingua: tag.trim().toLowerCase().split("-")[0], peso: Number.isNaN(peso) ? 0 : peso };
    })
    .filter((p) => p.peso > 0)
    .sort((a, b) => b.peso - a.peso);
  for (const { lingua } of pedidos) {
    if (lingua === "pt") return "pt-BR";
    if (lingua === "en") return "en";
  }
  return PRODUCT_LOCALE;
}
