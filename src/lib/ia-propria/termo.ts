/**
 * O termo da IA própria (ADR-0009 §2.4) — RASCUNHO, ainda sem revisão jurídica.
 *
 * Quem administra uma conta no plano "traga a sua IA" aceita este texto ANTES
 * de a primeira chave ser guardada: o banco recusa a chave enquanto não houver
 * aceite (`ia_sem_termo_aceito`). O aceite é gravado no registro da conta, com
 * autor, data e a VERSÃO abaixo. Trocar o texto exige trocar a versão: quem
 * aceitou a anterior não "aceitou" a nova sem ver.
 *
 * O que o texto precisa dizer, por decisão do André (07/11/2026): IA gratuita
 * pode usar o conteúdo para treinar o modelo, e então a confidencialidade do
 * manual acaba por escolha da agência; a Brennimark recomenda planos pagos; e
 * se a chave falhar o Vini não usa outra IA no lugar.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const TERMO_VERSAO = "2026-11-07";

export const TERMO = {
  pt: {
    titulo: "Termo de uso da IA própria",
    itens: [
      "Neste plano, a IA que atende o Vini é a da sua agência: você cadastra as chaves de API que já paga, e a Brennimark apenas encaminha as perguntas e os manuais a esses provedores.",
      "Quem escolhe o provedor e o plano contratado nele é a sua agência, e também responde por essa escolha. Provedores e planos gratuitos podem usar o conteúdo enviado, inclusive os manuais de marca dos seus clientes, para treinar modelos. Ao usá-los, a confidencialidade desse conteúdo termina por decisão da agência. A Brennimark recomenda planos pagos, com cláusula de não treinamento.",
      "A Brennimark não paga o uso da sua IA e não oferece outra no lugar: se uma chave deixar de funcionar, ficar sem saldo ou for recusada, o Vini avisa e para de responder nessa conta até a chave ser corrigida, ou a conta trocar para um plano com a IA da Brennimark.",
      "As chaves ficam guardadas cifradas, nunca aparecem de novo na tela, e são apagadas se a conta sair deste plano. Para trocar uma chave, cadastre outra no lugar.",
    ],
    aceite: "Li e aceito este termo em nome da conta.",
  },
  en: {
    titulo: "Own-AI terms of use",
    itens: [
      "On this plan, the AI behind Vini is your agency's: you register the API keys you already pay for, and Brennimark only forwards the questions and manuals to those providers.",
      "Your agency chooses the provider and the plan it holds there, and is responsible for that choice. Free providers and plans may use the content sent to them, including your clients' brand manuals, to train models. By using them, the confidentiality of that content ends by the agency's decision. Brennimark recommends paid plans with a no-training clause.",
      "Brennimark does not pay for your AI usage and does not offer another AI in its place: if a key stops working, runs out of credit or is refused, Vini says so and stops answering on this account until the key is fixed, or the account moves to a plan with Brennimark's AI.",
      "Keys are stored encrypted, never shown on screen again, and deleted if the account leaves this plan. To change a key, register a new one in its place.",
    ],
    aceite: "I have read and accept these terms on behalf of the account.",
  },
} as const;
