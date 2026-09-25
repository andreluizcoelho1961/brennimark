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
