/**
 * Quem opera o Brennimark — fonte única para os Termos, a Política de
 * privacidade e o rodapé do site (ajuste da revisão de conformidade, 07/10/2026).
 *
 * O nome empresarial do MEI traz o CPF do titular no fim: ele NÃO entra aqui.
 * O endereço físico é exigência do Decreto 7.962/2013, art. 2º. Decisão do
 * André (07/10/2026): publicar o endereço do CNPJ, onde fica o escritório dele.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const EMPRESA = {
  nome: "André Luiz Ferreira Coelho",
  natureza: "microempreendedor individual",
  cnpj: "47.924.458/0001-09",
  endereco: "Rua Vicente da Fontoura, 2547, apto. 406, Petrópolis",
  cidade: "Porto Alegre/RS",
  cep: "90460-019",
  email: "contato@brennimark.com",
  emailDePrivacidade: "privacidade@brennimark.com",
  /** O endereço dos links em e-mails que não nascem de um pedido (a rotina diária). */
  site: "https://www.brennimark.com",
} as const;

export const ENDERECO_COMPLETO = `${EMPRESA.endereco}, ${EMPRESA.cidade}, CEP ${EMPRESA.cep}`;
