/**
 * O idioma da INTERFACE.
 *
 * A distinção que este módulo existe para manter: o Brennimark tem um idioma,
 * e cada manual tem o seu. Eram a mesma coisa — 33 pontos decidiam a microcópia
 * da plataforma por `brandvilleInstance.metadata.language`, então importar um
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
 * DÍVIDA CONHECIDA: não há onde guardar a preferência da pessoa — `profiles`
 * não tem coluna de idioma. Por isso `resolveInterfaceLocale` hoje sempre
 * devolve o padrão. A escolha do usuário entra em uma função só, aqui, quando
 * a coluna existir; nenhum componente precisa mudar por causa disso.
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
