import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerMotivo } from "@/lib/console/ia";
import { chamadaDaAcaoDeCobranca, lerAcaoDeCobranca } from "@/lib/console/cobranca";
import { abrirCheckout } from "@/lib/cobranca/abrir-checkout";
import { createServiceClient } from "@/lib/supabase/service";
import { prazoDaSenhaProvisoria } from "@/lib/acesso/senha-provisoria";

/**
 * A cobrança no Console (fatia 2, 01/10/2026): planos, preços, assinaturas e
 * o link de pagamento do piloto.
 *
 * Quem pode decide o BANCO: as funções `console_*` recusam com 42501 quem não
 * é da equipe, e cada ação fica no registro com motivo. A rota traduz a
 * recusa em 404 — para quem não é da equipe, o Console não existe.
 */

const NAO_ENCONTRADO = () => NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
const RECUSA = (message: string) => NextResponse.json({ message }, { status: 400 });
const SEM_CACHE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("console_cobranca");
  if (error?.code === "42501") return NAO_ENCONTRADO();
  if (error) return NextResponse.json({ message: "Não foi possível ler a cobrança." }, { status: 500 });
  return NextResponse.json(data, SEM_CACHE);
}

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  const lida = lerAcaoDeCobranca(corpo);
  if (!lida.ok) return RECUSA(lida.motivo);
  const supabase = await createClient();

  // O link de piloto: a equipe gera, o cliente paga, a conta nasce do webhook.
  if (lida.acao.tipo === "link_de_piloto") {
    const { data: daEquipe } = await supabase.rpc("sou_da_equipe_brennimark");
    if (daEquipe !== true) return NAO_ENCONTRADO();
    const abertura = await abrirCheckout(lida.acao.pedido, new URL(request.url).origin, { piloto: true });
    if (!abertura.ok) return NextResponse.json({ message: abertura.motivo }, { status: abertura.status });
    return NextResponse.json({ url: abertura.url }, SEM_CACHE);
  }

  const motivo = lerMotivo(corpo?.motivo);
  if (!motivo) return RECUSA("Escreva o motivo (de 3 a 500 caracteres): ele fica no registro.");

  // O link de primeiro acesso do titular. O banco decide se pode (titular
  // criado pela compra, que nunca entrou) e registra o pedido; o servidor
  // marca o login para a troca de senha e gera o link, que abre a sessão e
  // leva à tela de criar a senha. O link não vai para log.
  if (lida.acao.tipo === "link_de_acesso") {
    const { data, error } = await supabase.rpc("console_titular_para_primeiro_acesso", { p_workspace_id: lida.acao.workspaceId, p_motivo: motivo });
    if (error?.code === "42501") return NAO_ENCONTRADO();
    if (error?.code === "P0002") return RECUSA("Esta conta não tem assinatura.");
    if (error?.code === "22023") return RECUSA("O titular já entrou na conta (ou o login não nasceu da compra): link de primeiro acesso não serve mais.");
    if (error?.code === "23514") return RECUSA("Escreva o motivo (de 3 a 500 caracteres): ele fica no registro.");
    const titular = Array.isArray(data) ? (data[0] as { user_id: string; email: string } | undefined) : undefined;
    if (error || !titular) return NextResponse.json({ message: "Não foi possível gerar o link." }, { status: 500 });

    let servico;
    try { servico = createServiceClient(); } catch {
      return NextResponse.json({ message: "A chave de serviço não está configurada." }, { status: 503 });
    }
    const validaAte = prazoDaSenhaProvisoria();
    const marca = await servico.auth.admin.updateUserById(titular.user_id, {
      app_metadata: { senha_provisoria_ate: validaAte, primeiro_acesso_por_link: true },
    });
    const link = marca.error ? null : await servico.auth.admin.generateLink({
      type: "magiclink", email: titular.email,
      options: { redirectTo: `${new URL(request.url).origin}/auth/callback?next=/trocar-senha` },
    });
    const url = link?.data?.properties?.action_link;
    if (!url) {
      console.error(JSON.stringify({ level: "error", msg: "link_de_primeiro_acesso_falhou", code: marca.error?.code ?? link?.error?.code ?? "unknown" }));
      return NextResponse.json({ message: "Não foi possível gerar o link." }, { status: 502 });
    }
    return NextResponse.json({ url, titular: titular.email, validaAte }, SEM_CACHE);
  }

  const { funcao, parametros } = chamadaDaAcaoDeCobranca(lida.acao, motivo);
  const { error } = await supabase.rpc(funcao, parametros);
  if (error?.code === "42501") return NAO_ENCONTRADO();
  if (error?.code === "P0002") return NextResponse.json({ message: "Preço não encontrado ou já inativo." }, { status: 404 });
  if (error?.code === "23503") return RECUSA("Esse plano não existe.");
  if (error?.code === "23505") return RECUSA("Esse preço do Stripe já está registrado.");
  if (error?.code === "23514" || error?.code === "22023") return RECUSA("Confira os valores: algum está fora do permitido.");
  if (error) return NextResponse.json({ message: "Não foi possível guardar a mudança." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
