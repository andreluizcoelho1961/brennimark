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
