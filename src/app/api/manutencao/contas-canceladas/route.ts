import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { drenarFilaDeExclusao } from "@/lib/import/limpeza";
import { segredoDoCronConfere } from "@/lib/assets/limpeza-de-orfaos";
import { rodarContasCanceladas } from "@/lib/cobranca/contas-canceladas";
import { emailConfigurado, enviarEmail } from "@/lib/email/enviar";
import { mensagemDeAvisoDeExclusao } from "@/lib/email/mensagens";
import { EMPRESA } from "@/lib/site/empresa";

/**
 * A rotina diária das contas canceladas — chamada pelo Vercel Cron
 * (`vercel.json`). A decisão vive em `@/lib/cobranca/contas-canceladas`; aqui
 * só as portas reais.
 *
 * ─── Quem chama ─────────────────────────────────────────────────────────
 *
 * Ninguém com sessão. O Vercel Cron manda `Authorization: Bearer
 * ${CRON_SECRET}`; sem ele, 401 antes de qualquer cliente existir. O `proxy`
 * deixa `/api/manutencao/` passar sem sessão — a trava é ESTA.
 *
 * ─── A chave de serviço, e o que a segura ───────────────────────────────
 *
 * As travas da exclusão (12 meses, aviso de 30 dias, nenhuma assinatura viva)
 * moram no BANCO, que as confere de novo a cada chamada. A drenagem com a
 * chave de serviço fica presa à pasta da conta (`exclusaoDaConta`) e só roda
 * para conta que o banco listou como em exclusão.
 *
 * Sem serviço de e-mail configurado, nenhum aviso sai — e sem aviso, nenhuma
 * conta chega à exclusão: o prazo de 30 dias conta do aviso que saiu.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!segredoDoCronConfere(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  let servico;
  try {
    servico = createServiceClient();
  } catch {
    return NextResponse.json({ message: "A chave de serviço não está configurada." }, { status: 503 });
  }

  const resumo = await rodarContasCanceladas({
    async contasAAvisar() {
      if (!emailConfigurado()) return [];
      const { data, error } = await servico.rpc("cobranca_contas_a_avisar_da_exclusao", { p_limite: 50 });
      if (error) throw new Error(`listar avisos: ${error.code}`);
      return ((data ?? []) as Array<{ id_externo_assinatura: string; titular_email: string; nome_da_conta: string | null; excluir_em: string }>)
        .map((l) => ({ idAssinatura: l.id_externo_assinatura, email: l.titular_email, nomeDaConta: l.nome_da_conta, excluirEm: l.excluir_em }));
    },
    async reservarAviso(idAssinatura, reservar) {
      const { data, error } = await servico.rpc("cobranca_aviso_de_exclusao", { p_id_externo_assinatura: idAssinatura, p_reservar: reservar });
      if (error) throw new Error(`aviso de exclusão: ${error.code}`);
      return data === true;
    },
    async avisar(conta) {
      const envio = await enviarEmail(conta.email, mensagemDeAvisoDeExclusao({
        conta: conta.nomeDaConta, excluirEm: conta.excluirEm, linkDeEntrar: `${EMPRESA.site}/login`, contato: EMPRESA.email,
      }));
      if (!envio.ok) throw new Error(`e-mail: ${envio.motivo}`);
    },
    async contasAExcluir() {
      const { data, error } = await servico.rpc("cobranca_contas_a_excluir", { p_limite: 20 });
      if (error) throw new Error(`listar exclusões: ${error.code}`);
      return (data ?? []) as Array<{ conta: string; iniciada: boolean }>;
    },
    async iniciarExclusao(conta) {
      const { data, error } = await servico.rpc("cobranca_iniciar_exclusao", { p_conta: conta });
      if (error) throw new Error(`iniciar: ${error.code} ${error.hint ?? ""}`.trim());
      return typeof data === "number" ? data : 0;
    },
    async drenar(conta) {
      const fila = await drenarFilaDeExclusao({ supabase: servico, workspaceId: conta }, { exclusaoDaConta: true });
      return { removidos: fila.removidos, pendentes: fila.pendentes };
    },
    async concluirExclusao(conta) {
      const { data, error } = await servico.rpc("cobranca_concluir_exclusao", { p_conta: conta });
      if (error) throw new Error(`concluir: ${error.code} ${error.hint ?? ""}`.trim());
      return data === "excluida" ? "excluida" : "pendente";
    },
    agora: () => Date.now(),
  });

  console.info(JSON.stringify({ level: resumo.falhas.length ? "error" : "info", msg: "contas_canceladas", ...resumo }));
  // Falha parcial é 500: o log do Cron precisa mostrar vermelho.
  return NextResponse.json(resumo, { status: resumo.falhas.length > 0 ? 500 : 200 });
}
