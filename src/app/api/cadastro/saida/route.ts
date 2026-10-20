import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { lerPedidoDeSaida } from "@/lib/cadastro/saida";

/**
 * A saída da lista de cadastros (17/10/2026): parar de receber e-mails, ou
 * apagar o cadastro. Quem chama é a página `/sair/<token>`, sem sessão (o
 * `proxy` deixa passar o caminho exato). A autorização é o token, que o BANCO
 * confere (`descadastrar_cadastro` e `apagar_cadastro`, só da chave de serviço).
 *
 * É POST de propósito: a página só MOSTRA as opções. Um GET que apagasse seria
 * disparado pelos antivírus e pré-visualizadores de e-mail que abrem todo link,
 * e apagaria o cadastro de quem nem leu a mensagem.
 */
const SEM_CACHE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const bruto = await request.text();
  if (bruto.length > 500) return NextResponse.json({ message: "Pedido grande demais." }, { status: 413 });
  let corpo: unknown = null;
  try { corpo = JSON.parse(bruto); } catch { /* a leitura recusa */ }

  const pedido = lerPedidoDeSaida(corpo);
  if (!pedido) return NextResponse.json({ message: "Este link não é válido." }, { status: 400, headers: SEM_CACHE });

  let servico;
  try { servico = createServiceClient(); } catch {
    console.error(JSON.stringify({ level: "error", msg: "saida_sem_chave" }));
    return NextResponse.json({ message: "Não foi possível agora. Tente de novo em instantes." }, { status: 503, headers: SEM_CACHE });
  }

  const funcao = pedido.acao === "apagar" ? "apagar_cadastro" : "descadastrar_cadastro";
  const { data, error } = await servico.rpc(funcao, { p_token: pedido.token });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "saida_falhou", acao: pedido.acao, code: error.code ?? "unknown" }));
    return NextResponse.json({ message: "Não foi possível agora. Tente de novo em instantes." }, { status: 500, headers: SEM_CACHE });
  }
  // `achou: false` = o token não existe (já apagado, ou link errado). O token é
  // um uuid aleatório: dizer isso não deixa ninguém descobrir e-mail nenhum.
  return NextResponse.json({ ok: true, achou: data === true, acao: pedido.acao }, { headers: SEM_CACHE });
}
