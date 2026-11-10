/**
 * O limite de taxa das rotas públicas (auditoria de 09/11/2026, A1).
 *
 * Rotas que passam pelo `proxy` sem sessão e mandam e-mail ou gravam no banco não tinham teto
 * nenhum. O contador mora NO BANCO (`limite_de_taxa_tentar`): memória da função não serve na
 * Vercel, que sobe várias instâncias e as derruba a qualquer momento.
 *
 * O que se guarda é o RESUMO (sha-256) do IP, nunca o IP. Quem chama a função é só o servidor,
 * com a chave de serviço.
 *
 * Falha ABERTA de propósito: se o banco não responde ou o IP não vem, a rota segue. Um limite que
 * derruba o cadastro quando o contador falha faria mais mal que o abuso que ele contém, e o erro
 * vai ao log. Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import { createHash } from "node:crypto";

type Cliente = { rpc: (nome: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> };

/** O IP de quem chama. Na Vercel o cabeçalho é reescrito pela borda; fora dela pode vir vazio. */
export function ipDoPedido(cabecalhos: Pick<Headers, "get">): string | null {
  const real = cabecalhos.get("x-real-ip")?.trim();
  if (real) return real;
  return cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

export function chaveDeLimite(rota: string, ip: string): string {
  return `${rota}:${createHash("sha256").update(ip).digest("hex")}`;
}

/** true = pode seguir; false = estourou o limite desta rota para este IP na janela. */
export async function dentroDoLimite(
  servico: Cliente,
  p: { rota: string; ip: string | null; limite: number; janelaSegundos: number },
): Promise<boolean> {
  if (!p.ip) return true;
  try {
    const { data, error } = await servico.rpc("limite_de_taxa_tentar", {
      p_chave: chaveDeLimite(p.rota, p.ip), p_limite: p.limite, p_janela_segundos: p.janelaSegundos,
    });
    if (error) {
      console.error(JSON.stringify({ level: "error", msg: "limite_de_taxa_falhou", rota: p.rota, code: error.code ?? "unknown" }));
      return true;
    }
    return data !== false;
  } catch {
    console.error(JSON.stringify({ level: "error", msg: "limite_de_taxa_falhou", rota: p.rota, code: "excecao" }));
    return true;
  }
}
