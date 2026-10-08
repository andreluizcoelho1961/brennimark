/**
 * Os e-mails do produto — o texto, sem rede e sem provedor.
 *
 * Cada mensagem sai em texto puro e em HTML simples (sem imagem, sem fonte
 * externa, sem rastreio): chega igual em qualquer cliente de e-mail, e o
 * texto puro é o que filtros de spam e leitores de tela leem primeiro.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export type Mensagem = { assunto: string; texto: string; html: string };

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escaparHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function html(paragrafos: string[], botao?: { rotulo: string; link: string }): string {
  const corpo = paragrafos.map((p) => `<p style="margin:0 0 16px">${escaparHtml(p)}</p>`).join("");
  const acao = botao
    ? `<p style="margin:24px 0"><a href="${escaparHtml(botao.link)}" style="display:inline-block;padding:12px 20px;border:1px solid #111;color:#111;text-decoration:none;font-weight:700">${escaparHtml(botao.rotulo)}</a></p>`
    + `<p style="margin:0 0 16px;font-size:12px;color:#555">Se o botão não abrir, copie este endereço no navegador:<br>${escaparHtml(botao.link)}</p>`
    : "";
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111;background:#fff">`
    + `<p style="margin:0 0 24px;font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase">Brennimark</p>`
    + corpo + acao + `</body></html>`;
}

/** O link de "Esqueci a senha". Quem não pediu não precisa fazer nada. */
export function mensagemDeRecuperacao(p: { link: string; validoPorMinutos: number }): Mensagem {
  const paragrafos = [
    "Recebemos um pedido para criar uma nova senha para este e-mail no Brennimark.",
    `O link abaixo vale por ${p.validoPorMinutos} minutos e serve uma vez.`,
  ];
  const fim = "Se não foi você, ignore esta mensagem: a sua senha continua a mesma.";
  return {
    assunto: "Crie uma nova senha no Brennimark",
    texto: [...paragrafos, "", `Criar nova senha: ${p.link}`, "", fim].join("\n"),
    html: html([...paragrafos], { rotulo: "Criar nova senha", link: p.link }).replace("</body>", `<p style="margin:0;font-size:12px;color:#555">${escaparHtml(fim)}</p></body>`),
  };
}

/**
 * A confirmação da assinatura, enviada quando a compra abre a conta. Ela não
 * leva link de acesso: quem não criou a senha na volta do pagamento usa
 * "Esqueci a senha" — e é o clique no e-mail que prova que o e-mail é dele.
 */
export function mensagemDeBoasVindas(p: { conta: string | null; linkDeEntrar: string; linkDeSenha: string }): Mensagem {
  const paragrafos = [
    p.conta ? `A assinatura da conta ${p.conta} está ativa.` : "A sua assinatura do Brennimark está ativa.",
    "Se você criou a senha na página de pagamento, é só entrar com este e-mail.",
    `Se ainda não criou, ou fechou a página antes, crie agora em ${p.linkDeSenha}`,
  ];
  return {
    assunto: "Sua assinatura do Brennimark está ativa",
    texto: [...paragrafos, "", `Entrar: ${p.linkDeEntrar}`].join("\n"),
    html: html(paragrafos, { rotulo: "Entrar no Brennimark", link: p.linkDeEntrar }),
  };
}

/** A data como o assinante lê, no horário de Brasília: "8 de novembro de 2026". */
export function dataPorExtenso(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })
    .format(new Date(iso));
}

/**
 * A confirmação do cancelamento — a promessa dos Termos (seção 13): "Confirmamos
 * o cancelamento na hora, por e-mail". Um texto por tipo (ver
 * `TipoDeCancelamento` em `cobranca/webhook.ts`); todos dizem o que acontece
 * com a conta: só leitura, guardada 12 meses, exportação a pedido.
 */
export function mensagemDeCancelamento(p: {
  conta: string | null;
  tipo: "arrependimento" | "falta-de-pagamento" | "no-fim-do-periodo" | "imediato";
  ate: string | null;
  linkDeEntrar: string;
}): Mensagem {
  const daConta = p.conta ? `da conta ${p.conta}` : "do Brennimark";
  const abertura: Record<typeof p.tipo, string[]> = {
    "arrependimento": [
      `A assinatura ${daConta} foi cancelada.`,
      "Como o cancelamento foi feito em até 7 dias da contratação, devolvemos o valor pago, por inteiro, no mesmo cartão da compra. O estorno já foi pedido ao Stripe e aparece na fatura conforme o prazo da operadora do cartão.",
      "O acesso completo terminou agora.",
    ],
    "falta-de-pagamento": [
      `A assinatura ${daConta} foi cancelada porque o pagamento não foi concluído depois das tentativas de cobrança.`,
    ],
    "no-fim-do-periodo": [
      `Confirmamos o cancelamento da assinatura ${daConta}.`,
      p.ate
        ? `O acesso completo continua até ${dataPorExtenso(p.ate)}, o fim do período já pago, e não haverá nova cobrança.`
        : "O acesso completo continua até o fim do período já pago, e não haverá nova cobrança.",
    ],
    "imediato": [
      `A assinatura ${daConta} foi cancelada, e não haverá nova cobrança.`,
    ],
  };
  const depois = [
    `${p.tipo === "no-fim-do-periodo" ? "Depois disso, a" : "A"} conta fica guardada só para leitura por 12 meses: dá para consultar, baixar e pedir a exportação do que é seu. Avisamos 30 dias antes do fim desse prazo.`,
    "Se mudar de ideia, é só assinar de novo.",
  ];
  const paragrafos = [...abertura[p.tipo], ...depois];
  return {
    assunto: p.tipo === "arrependimento" ? "Assinatura cancelada e valor devolvido" : "Sua assinatura do Brennimark foi cancelada",
    texto: [...paragrafos, "", `Entrar: ${p.linkDeEntrar}`].join("\n"),
    html: html(paragrafos, { rotulo: "Entrar no Brennimark", link: p.linkDeEntrar }),
  };
}

/**
 * O aviso de 30 dias antes da exclusão — Termos, seção 13: "Avisamos 30 dias
 * antes do fim desse prazo". Diz a data, o que sai, o que fica e o que fazer
 * para guardar o conteúdo.
 */
export function mensagemDeAvisoDeExclusao(p: { conta: string | null; excluirEm: string; linkDeEntrar: string; contato: string }): Mensagem {
  const daConta = p.conta ? `A conta ${p.conta}` : "A sua conta do Brennimark";
  const paragrafos = [
    `${daConta} foi cancelada há quase 12 meses e está guardada só para leitura.`,
    `Em ${dataPorExtenso(p.excluirEm)}, como dizem os Termos, o conteúdo dela será excluído definitivamente: marcas, manuais, arquivos e os acessos das pessoas convidadas.`,
    `Para guardar uma cópia, peça a exportação até lá: entre na conta, ou escreva para ${p.contato}. Entregamos os arquivos originais e um índice do conteúdo em até 15 dias.`,
    "Dados que a lei manda guardar, como os de cobrança, ficam pelo prazo legal. Se quiser voltar a usar o Brennimark, é só assinar de novo.",
  ];
  return {
    assunto: "Sua conta do Brennimark será excluída em 30 dias",
    texto: [...paragrafos, "", `Entrar: ${p.linkDeEntrar}`].join("\n"),
    html: html(paragrafos, { rotulo: "Entrar no Brennimark", link: p.linkDeEntrar }),
  };
}
