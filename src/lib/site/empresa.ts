/**
 * Quem opera o Brennimark — fonte única para os Termos, a Política de
 * privacidade e o rodapé do site (ajuste da revisão de conformidade, 07/10/2026).
 *
 * O nome empresarial do MEI traz o CPF do titular no fim: ele NÃO entra aqui.
 * O endereço físico fica entre colchetes até o André preencher — exigência do
 * Decreto 7.962/2013, art. 2º; a decisão de qual endereço publicar é dele.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const EMPRESA = {
  nome: "André Luiz Ferreira Coelho",
  natureza: "microempreendedor individual",
  cnpj: "47.924.458/0001-09",
  endereco: "[rua, número, bairro]",
  cidade: "Porto Alegre/RS",
  cep: "[—]",
  email: "contato@brennimark.com",
  emailDePrivacidade: "privacidade@brennimark.com",
} as const;

export const ENDERECO_COMPLETO = `${EMPRESA.endereco}, ${EMPRESA.cidade}, CEP ${EMPRESA.cep}`;
