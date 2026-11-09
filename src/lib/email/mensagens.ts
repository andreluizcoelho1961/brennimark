/**
 * Os e-mails do produto — o texto, sem rede e sem provedor.
 *
 * Cada mensagem sai em texto puro e em HTML simples (sem imagem, sem fonte
 * externa, sem rastreio): chega igual em qualquer cliente de e-mail, e o
 * texto puro é o que filtros de spam e leitores de tela leem primeiro.
 *
 * O IDIOMA é o de quem recebe (ver `idiomaDoEmail`): cada função recebe `t`, o
 * tradutor ligado ao trecho `email` do catálogo, e escreve a mensagem inteira
 * nele — assunto, corpo, botão e rodapé. O e-mail à equipe (pedido de exportação)
 * segue em português.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import type { Tradutor } from "../i18n/tradutor";

export type Mensagem = { assunto: string; texto: string; html: string };

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escaparHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function html(paragrafos: string[], t: Tradutor, botao?: { rotulo: string; link: string }): string {
  const corpo = paragrafos.map((p) => `<p style="margin:0 0 16px">${escaparHtml(p)}</p>`).join("");
  const acao = botao
    ? `<p style="margin:24px 0"><a href="${escaparHtml(botao.link)}" style="display:inline-block;padding:12px 20px;border:1px solid #111;color:#111;text-decoration:none;font-weight:700">${escaparHtml(botao.rotulo)}</a></p>`
    + `<p style="margin:0 0 16px;font-size:12px;color:#555">${escaparHtml(t("html.seOBotaoNaoAbrir"))}<br>${escaparHtml(botao.link)}</p>`
    : "";
  return `<!doctype html><html lang="${t("meta.lang")}"><body style="margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111;background:#fff">`
    + `<p style="margin:0 0 24px;font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase">Brennimark</p>`
    + corpo + acao + `</body></html>`;
}

/** O link de "Esqueci a senha". Quem não pediu não precisa fazer nada. */
export function mensagemDeRecuperacao(p: { link: string; validoPorMinutos: number }, t: Tradutor): Mensagem {
  const paragrafos = [t("recuperacao.p1"), t("recuperacao.p2", { min: p.validoPorMinutos })];
  const fim = t("recuperacao.fim");
  return {
    assunto: t("recuperacao.assunto"),
    texto: [...paragrafos, "", `${t("recuperacao.acao")}: ${p.link}`, "", fim].join("\n"),
    html: html([...paragrafos], t, { rotulo: t("recuperacao.acao"), link: p.link }).replace("</body>", `<p style="margin:0;font-size:12px;color:#555">${escaparHtml(fim)}</p></body>`),
  };
}

/**
 * A confirmação da assinatura, enviada quando a compra abre a conta. Ela não
 * leva link de acesso: quem não criou a senha na volta do pagamento usa
 * "Esqueci a senha" — e é o clique no e-mail que prova que o e-mail é dele.
 */
export function mensagemDeBoasVindas(p: { conta: string | null; linkDeEntrar: string; linkDeSenha: string }, t: Tradutor): Mensagem {
  const paragrafos = [
    p.conta ? t("boasVindas.comConta", { conta: p.conta }) : t("boasVindas.semConta"),
    t("boasVindas.p2"),
    t("boasVindas.p3", { link: p.linkDeSenha }),
  ];
  return {
    assunto: t("boasVindas.assunto"),
    texto: [...paragrafos, "", t("entrar", { link: p.linkDeEntrar })].join("\n"),
    html: html(paragrafos, t, { rotulo: t("boasVindas.acao"), link: p.linkDeEntrar }),
  };
}

/** A data como o assinante lê, no horário de Brasília: "8 de novembro de 2026" / "November 8, 2026". */
export function dataPorExtenso(iso: string, t: Tradutor): string {
  return new Intl.DateTimeFormat(t("meta.locale"), { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })
    .format(new Date(iso));
}

/**
 * A confirmação do cancelamento — a promessa dos Termos (seção 13): "Confirmamos
 * o cancelamento na hora, por e-mail". Um texto por tipo (ver
 * `TipoDeCancelamento` em `cobranca/webhook.ts`); todos dizem o que acontece
 * com a conta: só leitura, guardada 12 meses, exportação pela própria conta.
 */
export function mensagemDeCancelamento(p: {
  conta: string | null;
  tipo: "arrependimento" | "falta-de-pagamento" | "no-fim-do-periodo" | "imediato";
  ate: string | null;
  linkDeEntrar: string;
}, t: Tradutor): Mensagem {
  const daConta = p.conta ? t("cancelamento.daConta", { conta: p.conta }) : t("cancelamento.doBrennimark");
  const abertura: Record<typeof p.tipo, string[]> = {
    "arrependimento": [t("cancelamento.arrependimento1", { daConta }), t("cancelamento.arrependimento2"), t("cancelamento.arrependimento3")],
    "falta-de-pagamento": [t("cancelamento.falta", { daConta })],
    "no-fim-do-periodo": [
      t("cancelamento.fim1", { daConta }),
      p.ate ? t("cancelamento.fimComData", { data: dataPorExtenso(p.ate, t) }) : t("cancelamento.fimSemData"),
    ],
    "imediato": [t("cancelamento.imediato", { daConta })],
  };
  const depois = [p.tipo === "no-fim-do-periodo" ? t("cancelamento.depoisNoFim") : t("cancelamento.depois"), t("cancelamento.mudarDeIdeia")];
  const paragrafos = [...abertura[p.tipo], ...depois];
  return {
    assunto: p.tipo === "arrependimento" ? t("cancelamento.assuntoArrependimento") : t("cancelamento.assunto"),
    texto: [...paragrafos, "", t("entrar", { link: p.linkDeEntrar })].join("\n"),
    html: html(paragrafos, t, { rotulo: t("boasVindas.acao"), link: p.linkDeEntrar }),
  };
}

/**
 * O aviso de 30 dias antes da exclusão — Termos, seção 13: "Avisamos 30 dias
 * antes do fim desse prazo". Diz a data, o que sai, o que fica e o que fazer
 * para guardar o conteúdo.
 */
export function mensagemDeAvisoDeExclusao(p: { conta: string | null; excluirEm: string; linkDeEntrar: string; contato: string }, t: Tradutor): Mensagem {
  const daConta = p.conta ? t("exclusao.daConta", { conta: p.conta }) : t("exclusao.suaConta");
  const paragrafos = [
    t("exclusao.p1", { daConta }),
    t("exclusao.p2", { data: dataPorExtenso(p.excluirEm, t) }),
    t("exclusao.p3", { contato: p.contato }),
    t("exclusao.p4"),
  ];
  return {
    assunto: t("exclusao.assunto"),
    texto: [...paragrafos, "", t("entrar", { link: p.linkDeEntrar })].join("\n"),
    html: html(paragrafos, t, { rotulo: t("boasVindas.acao"), link: p.linkDeEntrar }),
  };
}

/**
 * O aviso à EQUIPE de que uma conta pediu a exportação: quem, quando e o
 * prazo de 15 dias. A entrega é marcada no Console.
 */
export function mensagemDePedidoDeExportacao(p: { conta: string; pedidoPor: string | null; pedidoEm: string; prazo: string; linkDoConsole: string }, t: Tradutor): Mensagem {
  const paragrafos = [
    t("equipe.p1", { conta: p.conta, data: dataPorExtenso(p.pedidoEm, t), por: p.pedidoPor ? t("equipe.por", { quem: p.pedidoPor }) : "" }),
    t("equipe.p2", { data: dataPorExtenso(p.prazo, t) }),
  ];
  return {
    assunto: t("equipe.assunto", { conta: p.conta }),
    texto: [...paragrafos, "", t("equipe.console", { link: p.linkDoConsole })].join("\n"),
    html: html(paragrafos, t, { rotulo: t("equipe.abrir"), link: p.linkDoConsole }),
  };
}

/**
 * A confirmação da inscrição na lista (18/10/2026, double opt-in). É uma
 * mensagem de serviço, sem nada de propaganda: pede um clique para provar que o
 * endereço é de quem se inscreveu. Quem não clicar não recebe marketing nenhum.
 */
export function mensagemDeConfirmacaoDaLista(p: { link: string; linkDeSair: string }, t: Tradutor): Mensagem {
  const paragrafos = [t("confirmacaoDaLista.p1"), t("confirmacaoDaLista.p2")];
  const fim = t("confirmacaoDaLista.fim", { link: p.linkDeSair });
  return {
    assunto: t("confirmacaoDaLista.assunto"),
    texto: [...paragrafos, "", t("confirmacaoDaLista.confirmar", { link: p.link }), "", fim].join("\n"),
    html: html(paragrafos, t, { rotulo: t("confirmacaoDaLista.acao"), link: p.link }).replace("</body>", `<p style="margin:0;font-size:12px;color:#555">${escaparHtml(fim)}</p></body>`),
  };
}

/**
 * Um e-mail de marketing (22/10/2026): o texto da campanha mais o rodapé legal.
 * O rodapé diz quem manda, por que a pessoa recebe e como sair, em um clique: a
 * identificação do remetente e a saída fácil são exigência da LGPD e do Marco
 * Civil, e o filtro de spam do Gmail e do iCloud lê o mesmo rodapé.
 */
export function mensagemDeMarketing(p: {
  assunto: string;
  paragrafos: string[];
  botao?: { rotulo: string; link: string };
  quando: string;
  linkDeSair: string;
  linkDaPolitica: string;
  empresa: { nome: string; cnpj: string; endereco: string };
}, t: Tradutor): Mensagem {
  const motivo = t("marketing.motivo", { quando: p.quando });
  const quem = t("marketing.quem", { nome: p.empresa.nome, cnpj: p.empresa.cnpj, endereco: p.empresa.endereco });
  const sair = t("marketing.sair", { link: p.linkDeSair });
  const politica = t("marketing.politica", { link: p.linkDaPolitica });

  const rodapeHtml =
    `<hr style="border:0;border-top:1px solid #ddd;margin:32px 0 16px">`
    + `<p style="margin:0 0 8px;font-size:12px;color:#555">${escaparHtml(motivo)}</p>`
    + `<p style="margin:0 0 8px;font-size:12px;color:#555">${escaparHtml(quem)}</p>`
    + `<p style="margin:0 0 8px;font-size:12px;color:#555">`
    + `<a href="${escaparHtml(p.linkDeSair)}" style="color:#111">${escaparHtml(t("marketing.sairLink"))}</a>`
    + ` &middot; <a href="${escaparHtml(p.linkDaPolitica)}" style="color:#111">${escaparHtml(t("marketing.politicaLink"))}</a></p>`;

  return {
    assunto: p.assunto,
    texto: [
      ...p.paragrafos,
      ...(p.botao ? ["", `${p.botao.rotulo}: ${p.botao.link}`] : []),
      "", "--", motivo, quem, sair, politica,
    ].join("\n"),
    html: html(p.paragrafos, t, p.botao).replace("</body>", `${rodapeHtml}</body>`),
  };
}
