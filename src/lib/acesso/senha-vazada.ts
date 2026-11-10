/**
 * Senha vazada (a pedido do André, 09/11/2026): o Supabase Free não liga a proteção
 * `auth_leaked_password_protection` (só Pro), então a checagem é nossa, no servidor, em toda rota que
 * DEFINE uma senha nova (`nova-senha`, `trocar-senha`, `cobranca/senha`).
 *
 * Como: k-anonimato do Have I Been Pwned. Calcula-se o SHA-1 da senha, manda-se SÓ os 5 primeiros
 * caracteres do hash a `api.pwnedpasswords.com/range/<prefixo>` e compara-se o resto aqui. A senha
 * (e o hash inteiro) nunca saem do servidor. `Add-Padding: true` esconde quantas linhas reais há.
 *
 * Falha ABERTA: API fora do ar, lenta (2 s) ou resposta estranha deixam a senha passar, com um aviso no
 * log. Travar quem escolhe senha por causa de um serviço de terceiros seria pior que o risco. O log
 * nunca leva a senha nem o hash.
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import { createHash } from "node:crypto";

export const URL_DA_FAIXA = "https://api.pwnedpasswords.com/range/";
export const PRAZO_MS = 2000;

export async function senhaVazada(senha: string, buscar: typeof fetch = fetch): Promise<boolean> {
  const hash = createHash("sha1").update(senha, "utf8").digest("hex").toUpperCase();
  const prefixo = hash.slice(0, 5);
  const sufixo = hash.slice(5);
  try {
    const r = await buscar(`${URL_DA_FAIXA}${prefixo}`, {
      headers: { "Add-Padding": "true" }, signal: AbortSignal.timeout(PRAZO_MS), cache: "no-store",
    });
    if (!r.ok) {
      console.warn(JSON.stringify({ level: "warn", msg: "senha_vazada_indisponivel", status: r.status }));
      return false;
    }
    const corpo = await r.text();
    for (const linha of corpo.split(/\r?\n/)) {
      const [achado, contagem] = linha.trim().split(":");
      // O preenchimento do Add-Padding vem com contagem 0: não é vazamento.
      if (achado?.toUpperCase() === sufixo && Number(contagem ?? "1") > 0) return true;
    }
    return false;
  } catch (erro) {
    console.warn(JSON.stringify({ level: "warn", msg: "senha_vazada_indisponivel", motivo: erro instanceof Error ? erro.name : "desconhecido" }));
    return false;
  }
}

export const FRASE_DE_SENHA_VAZADA = {
  pt: "Esta senha já apareceu em vazamentos de dados. Escolha outra.",
  en: "This password has appeared in data breaches. Choose another.",
} as const;
