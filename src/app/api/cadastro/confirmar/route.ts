import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { lerPedidoDeConfirmacao } from "@/lib/cadastro/saida";

/**
 * A confirmação do e-mail na lista de cadastros (18/10/2026, double opt-in).
 * Quem chama é a página `/confirmar/<token>`, sem sessão (o `proxy` deixa
 * passar o caminho exato). A autorização é o token, que o BANCO confere
 * (`confirmar_cadastro`, só da chave de serviço).
 *
 * É POST de propósito, como a saída: a página só MOSTRA o botão. Um GET que
 * confirmasse seria disparado pelos antivírus e pré-visualizadores de e-mail,
 * e "confirmaria" quem nunca clicou — o que anularia o motivo da confirmação.
 */
const SEM_CACHE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const bruto = await request.text();
  if (bruto.length > 500) return NextResponse.json({ message: "Pedido grande demais." }, { status: 413 });
  let corpo: unknown = null;
  try { corpo = JSON.parse(bruto); } catch { /* a leitura recusa */ }

  const pedido = lerPedidoDeConfirmacao(corpo);
  if (!pedido) return NextResponse.json({ message: "Este link não é válido." }, { status: 400, headers: SEM_CACHE });

  let servico;
  try { servico = createServiceClient(); } catch {
    console.error(JSON.stringify({ level: "error", msg: "confirmacao_sem_chave" }));
    return NextResponse.json({ message: "Não foi possível agora. Tente de novo em instantes." }, { status: 503, headers: SEM_CACHE });
  }

  const { data, error } = await servico.rpc("confirmar_cadastro", { p_token: pedido.token });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "confirmacao_falhou", code: error.code ?? "unknown" }));
    return NextResponse.json({ message: "Não foi possível agora. Tente de novo em instantes." }, { status: 500, headers: SEM_CACHE });
  }
  // `achou: false` = o token não existe, a pessoa saiu da lista, ou nunca aceitou
  // o marketing. O token é um uuid aleatório: dizer isso não revela e-mail nenhum.
  return NextResponse.json({ ok: true, achou: data === true }, { headers: SEM_CACHE });
}
