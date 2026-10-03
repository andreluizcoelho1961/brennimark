import "server-only";
import type { Mensagem } from "./mensagens";

/**
 * O envio de e-mail — a única porta. Como `getModel()` na IA e `stripe.ts` na
 * cobrança: trocar de serviço é reescrever ESTE arquivo, e nada mais.
 *
 * A chave e o remetente moram SÓ na Vercel, colados pelo André:
 *
 *   BRENNIMARK_CHAVE_EMAIL        a chave do serviço (Resend: `re_…`)
 *   BRENNIMARK_EMAIL_REMETENTE    quem envia, ex. `Brennimark <acesso@seudominio.com>`
 *
 * O remetente precisa ser de um domínio verificado no serviço — o
 * `brennimark.vercel.app` não serve (o domínio é da Vercel). Sem as duas
 * variáveis, `emailConfigurado()` diz que não, e as telas dizem que a
 * recuperação por e-mail ainda não está ligada.
 *
 * Nem o endereço de quem recebe nem o corpo vão para o log: só o desfecho.
 */
export type Envio = { ok: true } | { ok: false; motivo: "nao-configurado" | "recusado" | "rede" };

function configuracao(): { chave: string; remetente: string } | null {
  const chave = process.env.BRENNIMARK_CHAVE_EMAIL;
  const remetente = process.env.BRENNIMARK_EMAIL_REMETENTE;
  return chave && remetente ? { chave, remetente } : null;
}

export function emailConfigurado(): boolean {
  return configuracao() !== null;
}

/** Resend: https://resend.com/docs/api-reference/emails/send-email */
export async function enviarEmail(para: string, mensagem: Mensagem): Promise<Envio> {
  const c = configuracao();
  if (!c) return { ok: false, motivo: "nao-configurado" };
  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: c.remetente, to: [para], subject: mensagem.assunto, text: mensagem.texto, html: mensagem.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resposta.ok) {
      console.error(JSON.stringify({ level: "error", msg: "email_recusado", status: resposta.status }));
      return { ok: false, motivo: "recusado" };
    }
    return { ok: true };
  } catch (erro) {
    console.error(JSON.stringify({ level: "error", msg: "email_falhou", motivo: erro instanceof Error ? erro.name : "desconhecido" }));
    return { ok: false, motivo: "rede" };
  }
}
