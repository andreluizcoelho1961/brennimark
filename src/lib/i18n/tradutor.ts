/**
 * Um tradutor já ligado a um trecho do catálogo: `t("chave", { valor })`.
 *
 * É o formato de `useTranslations("ferramentas.cores")` e de
 * `getTranslations(...)`. As funções de `src/lib/*` que produzem texto (nomes
 * de cor, avisos, o LEIA-ME do pacote) recebem um destes em vez de escrever a
 * frase: assim rodam no navegador, no servidor e nos testes com o mesmo código,
 * e o idioma vem de quem chama.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export type Tradutor = (chave: string, valores?: Record<string, string | number>) => string;
