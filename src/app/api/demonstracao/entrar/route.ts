import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ACEITES, lerRespostaDoRegistro } from "@/lib/cadastro/cadastro";
import { conferirTurnstile } from "@/lib/demonstracao/turnstile";
import { emailSinteticoDoVisitante, lerDestino, lerPedidoDeEntrada, motivoDaRecusa, senhaDeUmaVez, textoDaRecusa } from "@/lib/demonstracao/entrada";
import { emailConfigurado, enviarEmail } from "@/lib/email/enviar";
import { mensagemDeConfirmacaoDaLista } from "@/lib/email/mensagens";
import { tradutorDoEmail } from "@/lib/email/tradutor-do-email";

/**
 * A entrada no tour (25/10/2026): quem não assina deixa nome e e-mail e entra,
 * só para consultar, num manual de demonstração.
 *
 * ─── Quem chama, e por que passa sem sessão ─────────────────────────────
 *
 * Um visitante do site, que não tem conta. Caminho EXATO em
 * `caminhos-publicos.ts`. Passar sem sessão não é passar sem autorização: o
 * usuário é criado AQUI, pelo servidor, só depois do captcha (Turnstile) e do
 * teto do dia (conferido pelo banco, em `demonstracao_receber`). Não se liga o
 * login anônimo do Supabase: ele daria um JWT `authenticated` a qualquer estranho.
 *
 * ─── O que o visitante é ────────────────────────────────────────────────
 *
 * Usuário de verdade, marcado `app_metadata.tour` (só a API de administração
 * escreve isso), com e-mail sintético `.invalid` e senha que ninguém conhece. O
 * e-mail REAL vai só para `cadastros_gratuitos` (origem `tour`), com a caixa de
 * marketing separada e desmarcada, e o mesmo duplo aceite das ferramentas. O
 * vínculo é `consultar` na marca do tour, que o BANCO escolhe, nunca o navegador.
 *
 * `website` é a isca de robô: preenchido, a resposta é a de sucesso e nada é feito.
 */
const TETO_DO_CORPO = 4_000;

export async function POST(request: Request) {
  const bruto = await request.text();
  let corpo: unknown = null;
  try { corpo = JSON.parse(bruto); } catch { /* a validação recusa */ }
  const pedidoBruto = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const idioma = pedidoBruto.idioma === "en" ? "en" : "pt-BR";
  const falha = (chave: Parameters<typeof textoDaRecusa>[0], status: number, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ message: textoDaRecusa(chave, idioma), ...extra }, { status, headers: { "Cache-Control": "no-store" } });

  if (bruto.length > TETO_DO_CORPO) return NextResponse.json({ message: idioma === "en" ? "Request too large." : "Pedido grande demais." }, { status: 413 });
  if (pedidoBruto.website) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });

  // Já há sessão (visitante que voltou do site, ou conta de verdade): não cria outro visitante, que
  // daria outra cota de perguntas ou trocaria a sessão de quem tem conta. Segue para o manual.
  const { data: { user: logado } } = await (await createClient()).auth.getUser();
  if (logado) return NextResponse.json({ ok: true, destino: "/docs", jaTinhaSessao: true }, { headers: { "Cache-Control": "no-store" } });

  const lido = lerPedidoDeEntrada(corpo);
  if (!lido.ok) return NextResponse.json({ message: lido.mensagem, campo: lido.campo }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const { dados: d, token } = lido.pedido;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const captcha = await conferirTurnstile({ token, ip, segredo: process.env.BRENNIMARK_TURNSTILE_SECRET, producao: process.env.NODE_ENV === "production" });
  if (captcha === "recusado") return falha("captcha", 400);
  if (captcha === "indisponivel") return falha("captcha_fora", 503);

  let servico;
  try { servico = createServiceClient(); } catch {
    console.error(JSON.stringify({ level: "error", msg: "tour_sem_chave" }));
    return falha("indisponivel", 503);
  }

  // O cadastro primeiro: o contato vale mesmo que o tour esteja cheio ou parado.
  const { data: registro, error: erroDoCadastro } = await servico.rpc("registrar_cadastro", {
    p_email: d.email, p_nome: d.nome, p_agencia: null, p_cargo: null,
    p_respostas: d.respostas, p_origem: "tour",
    p_aceite_marketing: d.aceiteMarketing, p_aceite_versao: d.aceiteMarketing ? ACEITES[d.idioma].versao : null,
  });
  if (erroDoCadastro) {
    console.error(JSON.stringify({ level: "error", msg: "tour_cadastro_falhou", code: erroDoCadastro.code ?? "unknown" }));
    return falha("desconhecido", 500);
  }
  const confirmacao = lerRespostaDoRegistro(registro);
  if (confirmacao.confirmar && emailConfigurado()) {
    const origem = new URL(request.url).origin;
    after(async () => {
      const envio = await enviarEmail(d.email, mensagemDeConfirmacaoDaLista({
        link: `${origem}/confirmar/${confirmacao.token}`,
        linkDeSair: `${origem}/sair/${confirmacao.token}`,
      }, await tradutorDoEmail(d.idioma)));
      if (!envio.ok) console.error(JSON.stringify({ level: "error", msg: "tour_confirmacao_nao_enviada", motivo: envio.motivo }));
    });
  }

  const email = emailSinteticoDoVisitante();
  const senha = senhaDeUmaVez();
  const { data: criado, error: erroAoCriar } = await servico.auth.admin.createUser({
    email, password: senha, email_confirm: true, app_metadata: { tour: true }, user_metadata: {},
  });
  if (erroAoCriar || !criado.user) {
    console.error(JSON.stringify({ level: "error", msg: "tour_usuario_nao_criado", status: erroAoCriar?.status ?? null }));
    return falha("desconhecido", 500);
  }
  const userId = criado.user.id;
  const desfazer = async () => { await servico.auth.admin.deleteUser(userId).catch(() => undefined); };

  const { data: destino, error: erroDaEntrada } = await servico.rpc("demonstracao_receber", {
    p_user: userId, p_nome: d.nome, p_email: d.email, p_idioma: d.idioma,
  });
  const entrada = erroDaEntrada ? null : lerDestino(destino);
  if (!entrada) {
    await desfazer();
    const motivo = motivoDaRecusa(erroDaEntrada?.message);
    if (motivo === "desconhecido") console.error(JSON.stringify({ level: "error", msg: "tour_entrada_falhou", code: erroDaEntrada?.code ?? "forma" }));
    return falha(motivo, motivo === "lotado" ? 429 : 503);
  }

  // Abre a sessão do navegador: os cookies saem nesta resposta.
  const sessao = await createClient();
  const { error: erroDaSessao } = await sessao.auth.signInWithPassword({ email, password: senha });
  if (erroDaSessao) {
    await desfazer();
    console.error(JSON.stringify({ level: "error", msg: "tour_sessao_falhou", status: erroDaSessao.status ?? null }));
    return falha("desconhecido", 500);
  }

  // O resolvedor de `/docs` leva quem tem uma conta e uma marca direto ao manual.
  return NextResponse.json({ ok: true, destino: "/docs", expiraEm: entrada.expiraEm }, { headers: { "Cache-Control": "no-store" } });
}
