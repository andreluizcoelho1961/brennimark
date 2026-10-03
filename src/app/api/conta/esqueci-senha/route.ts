import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { emailConfigurado, enviarEmail } from "@/lib/email/enviar";
import { mensagemDeRecuperacao } from "@/lib/email/mensagens";
import {
  CAMINHO_DA_NOVA_SENHA, PRAZO_DA_RECUPERACAO_MINUTOS, gerarSegredo, lerEmail, marcaDoPedido, podePedirDeNovo, resumoDoSegredo,
} from "@/lib/acesso/recuperacao";

/**
 * "Esqueci a senha" — o pedido (03/10/2026). As regras e o porquê estão em
 * `@/lib/acesso/recuperacao`.
 *
 * Passa pelo `proxy` sem sessão (caminho exato em `caminhos-publicos.ts`):
 * quem esqueceu a senha não tem sessão. A resposta é a MESMA exista o login ou
 * não, mande o e-mail ou não — inclusive quando o envio falha (o log diz).
 * Só a falta de configuração tem frase própria, porque ela vale para todos.
 */
const ENVIADO = () => NextResponse.json(
  { ok: true, message: "Se este e-mail tiver acesso ao Brennimark, enviamos um link para criar uma nova senha. Confira também a caixa de spam." },
  { headers: { "Cache-Control": "no-store" } },
);

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = lerEmail(corpo?.email);
  if (!email) return NextResponse.json({ message: "Confira o e-mail." }, { status: 400 });

  if (!emailConfigurado()) {
    return NextResponse.json({
      message: "A recuperação de senha por e-mail ainda não está ligada. Fale com quem administra a sua conta ou com a equipe da Brennimark.",
    }, { status: 503 });
  }

  let servico;
  try { servico = createServiceClient(); } catch {
    return NextResponse.json({ message: "A recuperação de senha ainda não está disponível." }, { status: 503 });
  }

  const segredo = gerarSegredo();
  const origem = new URL(request.url).origin;
  const destino = `${CAMINHO_DA_NOVA_SENHA}?r=${segredo}`;
  // O link do provedor abre a sessão e cai no callback, que leva à nova senha.
  // Login que não existe faz o provedor recusar — e a resposta é a mesma.
  const link = await servico.auth.admin.generateLink({
    type: "recovery", email,
    options: { redirectTo: `${origem}/auth/callback?next=${encodeURIComponent(destino)}` },
  });
  const usuario = link.data?.user;
  const endereco = link.data?.properties?.action_link;
  if (link.error || !usuario || !endereco) return ENVIADO();

  const agora = Date.now();
  if (!podePedirDeNovo(usuario.app_metadata, agora)) return ENVIADO();

  const marca = await servico.auth.admin.updateUserById(usuario.id, {
    app_metadata: { ...(usuario.app_metadata ?? {}), ...marcaDoPedido(await resumoDoSegredo(segredo), agora) },
  });
  if (marca.error) {
    console.error(JSON.stringify({ level: "error", msg: "recuperacao_marca_falhou", code: marca.error.code ?? "unknown" }));
    return ENVIADO();
  }

  const envio = await enviarEmail(email, mensagemDeRecuperacao({ link: endereco, validoPorMinutos: PRAZO_DA_RECUPERACAO_MINUTOS }));
  if (!envio.ok) console.error(JSON.stringify({ level: "error", msg: "recuperacao_envio_falhou", motivo: envio.motivo }));
  return ENVIADO();
}
