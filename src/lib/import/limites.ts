/**
 * Os limites da importação.
 *
 * Vivem num módulo SEM `"use client"` de propósito. Quando um componente de
 * servidor importa um valor de um módulo marcado como cliente, o Next não
 * entrega o valor: entrega uma referência de cliente. Para um componente isso
 * funciona; para um objeto comum, ler uma propriedade dele devolve `undefined`.
 *
 * O efeito disso era silencioso e grave: `arquivo.size > undefined` e
 * `numPages > undefined` são ambos falsos, então os dois limites simplesmente
 * deixavam de existir. Um PDF de 1.001 páginas passava direto.
 */
export const LIMITES_DE_IMPORTACAO = {
  /** 100 MiB. O mesmo teto do bucket. */
  maxBytes: 100 * 1024 * 1024,
  /** O mesmo teto que a RPC impõe. */
  maxPaginas: 1000,
};
