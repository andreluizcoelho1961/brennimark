import { escaparHtml, type Mensagem } from "./mensagens";

/**
 * O alerta à EQUIPE de que um pagamento de pacote avulso foi cobrado e NÃO creditado (auditoria de
 * 09/11/2026, M1). Sempre em português e sem dado de cliente além do que a equipe já vê no Console: a
 * sessão do Stripe, a conta e o motivo. O conserto manual está em `docs/plan/pacote-pago-sem-credito.md`.
 */
export function mensagemDePacoteNaoCreditado(p: { sessao: string | null; workspaceId: string | null; pacote: string | null; motivo: string; linkDoConsole: string }): Mensagem {
  const linhas = [
    "Um pagamento de pacote avulso de perguntas foi cobrado e NÃO foi creditado na conta.",
    `Sessão do Stripe: ${p.sessao ?? "não identificada"}`,
    `Conta: ${p.workspaceId ?? "não identificada"} · Pacote: ${p.pacote ?? "não identificado"}`,
    `Motivo: ${p.motivo}`,
    "O Stripe tenta o aviso de novo nos próximos dias; se a causa não se resolver sozinha, credite à mão ou estorne.",
  ];
  return {
    assunto: "Pacote pago e não creditado",
    texto: [...linhas, "", `Console: ${p.linkDoConsole}`].join("\n"),
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111;background:#fff">${linhas.map((l) => `<p style="margin:0 0 12px">${escaparHtml(l)}</p>`).join("")}<p><a href="${escaparHtml(p.linkDoConsole)}">${escaparHtml(p.linkDoConsole)}</a></p></body></html>`,
  };
}
