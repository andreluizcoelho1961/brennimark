import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerMotivo } from "@/lib/console/ia";
import {
  chavePublicaDe, conferirCertificado, emitirCertificado, lerAcaoDeFonts, lerChavePrivada, VARIAVEL_DA_CHAVE,
  type CamposDoBanco,
} from "@/lib/fonts-licencas/certificado";

/**
 * As licenças do Brennimark Fonts no Console (16/10/2026).
 *
 * Quem pode decide o BANCO: as funções `console_fonts_*` recusam com 42501 quem
 * não é da equipe, e cada ação fica no registro com motivo. A rota traduz a
 * recusa em 404 — para quem não é da equipe, o Console não existe.
 *
 * A ASSINATURA é feita aqui, não no banco: a chave privada só existe na Vercel.
 * Antes de registrar uma ativação, a rota confere que a chave está configurada
 * — uma ativação sem certificado possível seria um lugar gasto à toa.
 */

const NAO_ENCONTRADO = () => NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
const RECUSA = (message: string, status = 400) => NextResponse.json({ message }, { status });
const SEM_CACHE = { headers: { "Cache-Control": "private, no-store" } };

const MENSAGENS: Record<string, string> = {
  limite_de_dispositivos: "Esta licença já usa todos os computadores. Revogue um para liberar o lugar.",
  licenca_revogada: "Esta licença (ou esta ativação) foi revogada: não emite certificado.",
  licenca_vencida: "Esta licença venceu: não emite certificado.",
};

type ErroDoBanco = { code?: string; message?: string; details?: string } | null;

/** O erro do banco vira resposta; devolve `null` se não houve erro. */
function traduzir(error: ErroDoBanco): NextResponse | null {
  if (!error) return null;
  if (error.code === "42501") return NAO_ENCONTRADO();
  if (error.code === "P0002") return RECUSA("Licença ou ativação não encontrada.", 404);
  if (error.code === "P0001") return RECUSA(MENSAGENS[error.details ?? ""] ?? "A ação não pôde ser feita.", 409);
  if (error.code === "23514" || error.code === "22023") return RECUSA("Dados fora do permitido para uma licença.");
  return RECUSA("Não foi possível concluir. Tente de novo.", 500);
}

function certificadoDe(campos: CamposDoBanco, chave: NonNullable<ReturnType<typeof lerChavePrivada>>) {
  const certificado = emitirCertificado(campos, chave);
  // Auto-conferência: nunca devolve um arquivo que o aplicativo recusaria.
  if (!conferirCertificado(certificado, chavePublicaDe(chave))) throw new Error("certificado não confere");
  return certificado;
}

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("console_fonts_licencas");
  const resposta = traduzir(error);
  if (resposta) return resposta;
  return NextResponse.json({ licencas: data ?? [], chaveConfigurada: lerChavePrivada(process.env[VARIAVEL_DA_CHAVE]) !== null }, SEM_CACHE);
}

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  const motivo = lerMotivo(corpo?.motivo);
  if (!motivo) return RECUSA("Escreva o motivo (de 3 a 500 caracteres): ele fica no registro.");
  const lida = lerAcaoDeFonts(corpo);
  if (!lida.ok) return RECUSA(lida.motivo);
  const acao = lida.acao;

  const supabase = await createClient();

  if (acao.acao === "criar") {
    const { data, error } = await supabase.rpc("console_fonts_criar_licenca", {
      p_plano: acao.plano, p_max_dispositivos: acao.dispositivos, p_titular_nome: acao.nome, p_titular_email: acao.email,
      p_agencia: acao.agencia, p_dias: acao.dias, p_motivo: motivo,
    });
    return traduzir(error) ?? NextResponse.json(data, SEM_CACHE);
  }

  if (acao.acao === "revogar-ativacao") {
    const { error } = await supabase.rpc("console_fonts_revogar_ativacao", { p_ativacao_id: acao.ativacaoId, p_motivo: motivo });
    return traduzir(error) ?? NextResponse.json({ ok: true });
  }

  if (acao.acao === "revogar-licenca") {
    const { error } = await supabase.rpc("console_fonts_revogar_licenca", { p_licenca_id: acao.licencaId, p_motivo: motivo });
    return traduzir(error) ?? NextResponse.json({ ok: true });
  }

  // Ativar e refazer o certificado precisam da chave.
  const chave = lerChavePrivada(process.env[VARIAVEL_DA_CHAVE]);
  if (!chave) return RECUSA("A chave de assinatura das licenças não está configurada neste ambiente. Nada foi registrado.", 503);

  const chamada = acao.acao === "ativar"
    ? await supabase.rpc("console_fonts_ativar", { p_licenca_id: acao.licencaId, p_codigo: acao.codigo, p_motivo: motivo })
    : await supabase.rpc("console_fonts_ativacao", { p_ativacao_id: acao.ativacaoId });
  const resposta = traduzir(chamada.error);
  if (resposta) return resposta;

  const campos = chamada.data as CamposDoBanco;
  const certificado = certificadoDe(campos, chave);
  return NextResponse.json(
    { certificado, arquivo: `brennimark-fonts-${campos.license_number}.json`, lugares: campos.max_devices },
    SEM_CACHE,
  );
}
