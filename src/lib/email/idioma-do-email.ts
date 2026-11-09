/**
 * O idioma de um e-mail é o de QUEM RECEBE, e cada e-mail sabe de onde tirar:
 *   - cadastro nas ferramentas: o idioma da tela em que a pessoa se cadastrou
 *     (`respostas.idioma`);
 *   - assinatura (boas-vindas, cancelamento, aviso de exclusão): a moeda da
 *     assinatura — quem assina em dólar usa o site em inglês;
 *   - "esqueci a senha": o idioma da sessão (cookie, perfil ou navegador);
 *   - equipe e Console: português.
 *
 * Puro (sem next-intl), para os testes de unidade.
 */
export type IdiomaDoEmail = "pt-BR" | "en";

export function idiomaDoEmailPelaMoeda(moeda: string | null | undefined): IdiomaDoEmail {
  return moeda?.toUpperCase() === "USD" ? "en" : "pt-BR";
}
