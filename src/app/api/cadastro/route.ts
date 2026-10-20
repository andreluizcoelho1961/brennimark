import { after, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { COOKIE_DO_CADASTRO, VERSAO_DO_ACEITE, comMarcaDoConvite, lerRespostaDoRegistro, validarCadastro } from "@/lib/cadastro/cadastro";
import { emailConfigurado, enviarEmail } from "@/lib/email/enviar";
import { mensagemDeConfirmacaoDaLista } from "@/lib/email/mensagens";

/**
 * O cadastro gratuito (17/10/2026): quem baixa ou exporta de uma ferramenta do
 * site deixa e-mail, nome e algumas respostas. Não é login: ninguém ganha
 * sessão, e a resposta não diz se o e-mail já estava na lista.
 *
 * Passa pelo `proxy` sem sessão (caminho exato em `caminhos-publicos.ts`): quem
 * usa as ferramentas não tem conta. Passar sem sessão não é passar sem
 * autorização: a tabela é fechada a qualquer sessão, e só esta rota, com a
 * chave de serviço, a grava, pela função `registrar_cadastro`.
 *
 * Quem marca a caixa de marketing recebe um e-mail de confirmação (ver o fim da
 * função): só quem clicar entra na lista de marketing.
 *
 * `website` é a isca para robô: um campo escondido que pessoa nenhuma preenche.
 * Veio preenchido, a resposta é a de sucesso e nada é gravado.
 */
const TETO_DO_CORPO = 4_000;

export async function POST(request: Request) {
  const bruto = await request.text();
  if (bruto.length > TETO_DO_CORPO) return NextResponse.json({ message: "Pedido grande demais." }, { status: 413 });

  let corpo: unknown = null;
  try { corpo = JSON.parse(bruto); } catch { /* a validação recusa */ }

  const resposta = () => {
    const r = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    // Só diz ao navegador "já cadastrei": não é segredo e não dá acesso a nada.
    r.cookies.set(COOKIE_DO_CADASTRO, "1", { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    return r;
  };

  if (corpo && typeof corpo === "object" && (corpo as { website?: unknown }).website) return resposta();

  const v = validarCadastro(corpo);
  if (!v.ok) return NextResponse.json({ message: v.mensagem, campo: v.campo }, { status: 400 });
  const d = comMarcaDoConvite(v.dados, new Date());

  let servico;
  try { servico = createServiceClient(); } catch {
    console.error(JSON.stringify({ level: "error", msg: "cadastro_sem_chave" }));
    return NextResponse.json({ message: "O cadastro não está disponível agora. Tente de novo em instantes." }, { status: 503 });
  }

  const { data, error } = await servico.rpc("registrar_cadastro", {
    p_email: d.email, p_nome: d.nome, p_agencia: d.agencia, p_cargo: d.cargo,
    p_respostas: d.respostas, p_origem: d.origem,
    p_aceite_marketing: d.aceiteMarketing, p_aceite_versao: d.aceiteMarketing ? VERSAO_DO_ACEITE : null,
  });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "cadastro_falhou", code: error.code ?? "unknown" }));
    return NextResponse.json({ message: "Não foi possível guardar o cadastro. Tente de novo." }, { status: 500 });
  }

  // Double opt-in (18/10/2026): quem marcou a caixa recebe um e-mail para provar
  // que o endereço é dele. O banco decide se é preciso (e só entrega o token
  // então): caixa marcada, ainda sem confirmar, e nenhum envio nas últimas 24
  // horas. O e-mail sai DEPOIS da resposta: o download não espera o Resend, e
  // uma falha dele só vai para o log.
  const registro = lerRespostaDoRegistro(data);
  if (registro.confirmar && emailConfigurado()) {
    const origem = new URL(request.url).origin;
    after(async () => {
      const envio = await enviarEmail(d.email, mensagemDeConfirmacaoDaLista({
        link: `${origem}/confirmar/${registro.token}`,
        linkDeSair: `${origem}/sair/${registro.token}`,
      }));
      if (!envio.ok) console.error(JSON.stringify({ level: "error", msg: "cadastro_confirmacao_nao_enviada", motivo: envio.motivo }));
    });
  }
  return resposta();
}
