import { tradutorDoEmail } from "@/lib/email/tradutor-do-email";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerMotivo } from "@/lib/console/ia";
import { EMPRESA, ENDERECO_COMPLETO } from "@/lib/site/empresa";
import { emailConfigurado, enviarEmail } from "@/lib/email/enviar";
import { dataPorExtenso, mensagemDeMarketing } from "@/lib/email/mensagens";
import { campanhaDe, idiomaDoDestinatario, personalizar, textoDaCampanha, type Campanha, type Idioma } from "@/lib/email/campanhas";
import { caminhoDoSite } from "@/lib/site/idiomas";
import { cabecalhosDeSaida, lerAcaoDeEmail } from "@/lib/email/marketing";

/**
 * O e-mail de marketing no Console (22/10/2026): testar a campanha e enviá-la,
 * aos poucos, a quem aceitou, confirmou e não saiu.
 *
 * Quem pode e quem recebe decide o BANCO: as funções `console_email_*` recusam
 * com 42501 quem não é da equipe, escolhem só os elegíveis, marcam cada pessoa
 * UMA vez por campanha e registram a reserva no registro da equipe, com motivo.
 * A rota traduz a recusa em 404 (para quem não é da equipe, o Console não
 * existe) e faz o que o banco não faz: o envio de fato.
 *
 * O envio é sequencial e devagar (cerca de duas mensagens por segundo, o que o
 * Resend aceita) e limitado a 25 por clique, para caber na duração da função.
 * Cada pessoa é marcada como enviada ou falha logo depois do envio dela.
 */
export const maxDuration = 60;

const PAUSA_ENTRE_ENVIOS_MS = 600;

const NAO_ENCONTRADO = () => NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
const RECUSA = (message: string, status = 400) => NextResponse.json({ message }, { status });
const SEM_CACHE = { headers: { "Cache-Control": "private, no-store" } };

type ErroDoBanco = { code?: string; message?: string } | null;

function traduzir(error: ErroDoBanco): NextResponse | null {
  if (!error) return null;
  if (error.code === "42501") return NAO_ENCONTRADO();
  if (error.code === "22023" || error.code === "23514") return RECUSA("Dados fora do permitido para este envio.");
  return RECUSA("Não foi possível concluir. Tente de novo.", 500);
}

type Tradutores = Record<Idioma, Awaited<ReturnType<typeof tradutorDoEmail>>>;

/**
 * O e-mail pronto de uma pessoa, TODO no idioma dela: texto da campanha, rodapé legal,
 * data do aceite e o endereço do botão e da política (o site em inglês para quem se
 * cadastrou em inglês). `/sair/` é da plataforma e fala os dois idiomas pela sessão.
 */
function montar(campanha: Campanha, idioma: Idioma, pessoa: { nome: string; token: string; aceiteEm: string | null }, tradutores: Tradutores) {
  const site = EMPRESA.site;
  const t = tradutores[idioma];
  const texto = textoDaCampanha(campanha, idioma);
  const mensagem = mensagemDeMarketing({
    assunto: texto.assunto,
    paragrafos: texto.paragrafos.map((p) => personalizar(p, pessoa.nome)),
    botao: texto.botao ? { rotulo: texto.botao.rotulo, link: `${site}${caminhoDoSite(idioma, texto.botao.caminho)}` } : undefined,
    quando: pessoa.aceiteEm ? dataPorExtenso(pessoa.aceiteEm, t) : t("marketing.dataAnterior"),
    linkDeSair: `${site}/sair/${pessoa.token}`,
    linkDaPolitica: `${site}${caminhoDoSite(idioma, "/privacidade")}`,
    empresa: { nome: EMPRESA.nome, cnpj: EMPRESA.cnpj, endereco: ENDERECO_COMPLETO },
  }, t);
  return { mensagem, opcoes: { replyTo: EMPRESA.email, headers: cabecalhosDeSaida(`${site}/api/sair/${pessoa.token}`) } };
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  const lida = lerAcaoDeEmail(corpo);
  if (!lida.ok) return RECUSA(lida.motivo);
  const acao = lida.acao;
  const campanha = campanhaDe(acao.campanha) as Campanha;
  // O Console é em português, mas cada e-mail sai no idioma de QUEM RECEBE (texto e rodapé).
  const tradutores: Tradutores = { "pt-BR": await tradutorDoEmail("pt-BR"), en: await tradutorDoEmail("en") };

  const supabase = await createClient();

  if (acao.acao === "resumo") {
    const { data, error } = await supabase.rpc("console_email_resumo", {
      p_campanha: acao.campanha, p_cargos: acao.cargos, p_equipes: acao.equipes,
    });
    const resposta = traduzir(error);
    if (resposta) return resposta;
    return NextResponse.json({ resumo: data, configurado: emailConfigurado() }, SEM_CACHE);
  }

  // Teste e envio mandam e-mail de verdade: sem o serviço ligado, nada é registrado.
  if (!emailConfigurado()) return RECUSA("O envio de e-mail não está configurado neste ambiente. Nada foi enviado.", 503);

  if (acao.acao === "teste") {
    const { data: equipe } = await supabase.rpc("sou_da_equipe_brennimark");
    if (equipe !== true) return NAO_ENCONTRADO();
    const { data: usuario } = await supabase.auth.getUser();
    const para = usuario.user?.email;
    if (!para) return RECUSA("Não achei o seu e-mail de login.");
    // O teste leva o rótulo no assunto e um endereço de saída que não existe: o link
    // do rodapé não apaga cadastro nenhum.
    const { mensagem, opcoes } = montar(campanha, acao.idioma, { nome: "", token: "00000000-0000-4000-8000-000000000000", aceiteEm: null }, tradutores);
    const envio = await enviarEmail(para, { ...mensagem, assunto: `[TESTE] ${mensagem.assunto}` }, opcoes);
    if (!envio.ok) return RECUSA("O serviço de e-mail não aceitou o envio. Tente de novo.", 502);
    return NextResponse.json({ ok: true, para }, SEM_CACHE);
  }

  const motivo = lerMotivo((corpo as { motivo?: unknown } | null)?.motivo);
  if (!motivo) return RECUSA("Escreva o motivo (de 3 a 500 caracteres): ele fica no registro.");

  const { data, error } = await supabase.rpc("console_email_reservar", {
    p_campanha: acao.campanha, p_cargos: acao.cargos, p_equipes: acao.equipes, p_limite: acao.limite, p_motivo: motivo,
  });
  const resposta = traduzir(error);
  if (resposta) return resposta;

  const escolhidos = (data ?? []) as { cadastro_id: string; email: string; nome: string; token: string; aceite_em: string | null; idioma?: string }[];
  let enviados = 0;
  let falhas = 0;
  for (const [i, p] of escolhidos.entries()) {
    if (i > 0) await espera(PAUSA_ENTRE_ENVIOS_MS);
    const { mensagem, opcoes } = montar(campanha, idiomaDoDestinatario(p.idioma), { nome: p.nome, token: p.token, aceiteEm: p.aceite_em }, tradutores);
    const envio = await enviarEmail(p.email, mensagem, opcoes);
    const { error: erroDeMarca } = await supabase.rpc("console_email_marcar", {
      p_campanha: acao.campanha, p_cadastro_id: p.cadastro_id, p_enviado: envio.ok,
    });
    if (erroDeMarca) console.error(JSON.stringify({ level: "error", msg: "email_marcar_falhou", code: erroDeMarca.code ?? "unknown" }));
    if (envio.ok) enviados += 1; else falhas += 1;
  }
  return NextResponse.json({ tentados: escolhidos.length, enviados, falhas }, SEM_CACHE);
}
