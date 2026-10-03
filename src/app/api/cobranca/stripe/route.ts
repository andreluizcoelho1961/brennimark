import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buscarAssinaturaNoStripe, chavesDoStripe, lerAvisoAssinado } from "@/lib/cobranca/stripe";
import { processarAviso, type Recebimento } from "@/lib/cobranca/webhook";
import { emailConfigurado, enviarEmail } from "@/lib/email/enviar";
import { mensagemDeBoasVindas } from "@/lib/email/mensagens";

/**
 * O webhook do Stripe — por onde a conta paga NASCE (fatia 1 da cobrança,
 * 01/10/2026). A decisão vive em `@/lib/cobranca/webhook`; aqui só as portas.
 *
 * ─── Quem chama ─────────────────────────────────────────────────────────
 *
 * O Stripe, sem sessão. O `proxy` deixa `/api/cobranca/` passar
 * (`caminhos-publicos.ts`), e a trava é a ASSINATURA do aviso: sem ela, ou com
 * ela errada, 400 antes de qualquer banco. É o que impede alguém de inventar
 * um "pagamento confirmado" e ganhar uma conta.
 *
 * ─── O que responder ────────────────────────────────────────────────────
 *
 *   200  processado, ignorado ou repetido — o Stripe não manda de novo
 *   400  assinatura ausente ou que não confere
 *   500  falhou no meio — o Stripe tenta de novo, e o aviso fica "falhou" no banco
 *   503  chaves não configuradas — o Stripe também tenta de novo
 *
 * Nada do corpo vai ao log: ele tem e-mail e nome de cliente. Só o
 * identificador do aviso, o tipo e o desfecho.
 */
export async function POST(request: Request) {
  const chaves = chavesDoStripe();
  if (!chaves) {
    console.error(JSON.stringify({ level: "error", msg: "cobranca_sem_chaves_do_stripe" }));
    return NextResponse.json({ message: "Cobrança não configurada." }, { status: 503 });
  }

  const cabecalho = request.headers.get("stripe-signature");
  const corpo = await request.text();
  const aviso = cabecalho ? await lerAvisoAssinado(corpo, cabecalho, chaves.segredoDoWebhook) : null;
  if (!aviso) {
    return NextResponse.json({ message: "Assinatura do aviso não confere." }, { status: 400 });
  }

  let servico;
  try {
    servico = createServiceClient();
  } catch {
    return NextResponse.json({ message: "A chave de serviço não está configurada." }, { status: 503 });
  }

  try {
    const desfecho = await processarAviso("stripe", aviso, {
      async receber(provedor, idDoAviso, tipo) {
        const { data, error } = await servico.rpc("cobranca_receber_evento", {
          p_provedor: provedor, p_id_externo: idDoAviso, p_tipo: tipo,
        });
        if (error) throw new Error(`receber: ${error.code}`);
        return data as Recebimento;
      },
      async concluir(provedor, idDoAviso, resultado, detalhe, idAssinatura) {
        const { error } = await servico.rpc("cobranca_concluir_evento", {
          p_provedor: provedor, p_id_externo: idDoAviso, p_resultado: resultado,
          p_detalhe: detalhe, p_id_externo_assinatura: idAssinatura,
        });
        if (error) throw new Error(`concluir: ${error.code}`);
      },
      buscarAssinatura: (idAssinatura) => buscarAssinaturaNoStripe(chaves.chave, idAssinatura),
      async garantirLogin(email, nome, idAssinatura) {
        // Sem senha: quem comprou a cria na volta do pagamento, e só a volta
        // desta compra pode (`criado_pela_assinatura`, ver senha-na-volta.ts).
        const { error } = await servico.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: nome ? { full_name: nome } : {},
          app_metadata: { criado_pela_cobranca: true, criado_pela_assinatura: idAssinatura },
        });
        if (error && error.code !== "email_exists" && error.code !== "user_already_exists") {
          throw new Error(`login: ${error.code ?? "desconhecido"}`);
        }
        // Login NOVO: a confirmação da assinatura vai ao e-mail da compra, e
        // manda quem não criou a senha na volta ao "Esqueci a senha" — que é o
        // que prova que o e-mail é da pessoa. Falha no e-mail não falha o
        // aviso: a conta precisa nascer de qualquer jeito.
        if (!error && emailConfigurado()) {
          const origem = new URL(request.url).origin;
          const envio = await enviarEmail(email, mensagemDeBoasVindas({
            conta: null, linkDeEntrar: `${origem}/login`, linkDeSenha: `${origem}/esqueci-senha`,
          }));
          if (!envio.ok) console.error(JSON.stringify({ level: "error", msg: "cobranca_boas_vindas_falhou", motivo: envio.motivo }));
        }
      },
      async sincronizar(a) {
        const { data, error } = await servico.rpc("cobranca_sincronizar_assinatura", {
          p_provedor: "stripe",
          p_id_externo_cliente: a.idCliente,
          p_id_externo_assinatura: a.idAssinatura,
          p_id_externo_preco: a.idPreco,
          p_situacao: a.situacao,
          p_periodo_pago_ate: a.periodoPagoAte,
          p_cancelar_no_fim: a.cancelarNoFim,
          p_moeda: a.moeda,
          p_titular: null,
          p_titular_email: a.emailDoTitular,
          p_nome_da_conta: a.nomeDaConta,
        });
        // O PostgREST não devolve o nome da constraint; a função põe o motivo no `hint`.
        if (error) throw new Error(`sincronizar: ${error.code} ${error.hint ?? ""}`.trim());
        return (data as string | null) ?? null;
      },
    });
    console.info(JSON.stringify({ level: "info", msg: "cobranca_aviso", aviso: aviso.id, tipo: aviso.type, resultado: desfecho.resultado }));
    return NextResponse.json({ recebido: true });
  } catch (erro) {
    console.error(JSON.stringify({
      level: "error", msg: "cobranca_aviso_falhou", aviso: aviso.id, tipo: aviso.type,
      motivo: erro instanceof Error ? erro.message.slice(0, 200) : "desconhecido",
    }));
    return NextResponse.json({ message: "Falhou; o Stripe tenta de novo." }, { status: 500 });
  }
}
