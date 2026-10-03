import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { conferirSenhaNova } from "@/lib/acesso/senha-provisoria";
import { MARCA_APAGADA, conferirSegredo } from "@/lib/acesso/recuperacao";

/**
 * "Esqueci a senha" — a troca (03/10/2026). Pede a sessão (aberta pelo link do
 * e-mail) E o segredo do endereço, conferido contra o resumo guardado no
 * login. Uma sessão sozinha não troca senha.
 *
 * A troca também resolve quem tinha senha provisória ou link de primeiro
 * acesso: o e-mail provou quem é, então as marcas saem junto, e o acesso é
 * ativado como na troca da senha provisória (`ativar_login`, idempotente).
 *
 * A senha não vai para log nem para a resposta.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Abra de novo o link do e-mail." }, { status: 401 });

  const corpo = await request.json().catch(() => null) as { segredo?: unknown; senha?: unknown; confirmacao?: unknown } | null;
  const conferencia = await conferirSegredo(user.app_metadata, corpo?.segredo, Date.now());
  if (conferencia !== "confere") {
    return NextResponse.json({
      message: conferencia === "vencido"
        ? "Este link venceu. Peça outro em “Esqueci a senha”."
        : "Este link não vale mais. Peça outro em “Esqueci a senha”.",
    }, { status: 410 });
  }

  const recusa = conferirSenhaNova(corpo?.senha, corpo?.confirmacao);
  if (recusa) {
    const frases = {
      curta: "A senha precisa de ao menos 12 caracteres.",
      longa: "A senha passou do tamanho máximo.",
      diferentes: "As duas senhas não são iguais.",
    } as const;
    return NextResponse.json({ message: frases[recusa] }, { status: 400 });
  }

  const servico = createServiceClient();
  const { error } = await servico.auth.admin.updateUserById(user.id, {
    password: corpo?.senha as string,
    app_metadata: { ...(user.app_metadata ?? {}), ...MARCA_APAGADA, senha_provisoria_ate: null, primeiro_acesso_por_link: null },
  });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "nova_senha_falhou", code: error.code ?? "unknown" }));
    const fraca = error.code === "weak_password";
    return NextResponse.json({
      message: fraca ? "Esta senha é fácil demais de adivinhar. Escolha outra." : "Não foi possível trocar a senha. Tente de novo.",
    }, { status: fraca ? 400 : 502 });
  }

  const { error: erroDaAtivacao } = await servico.rpc("ativar_login", { p_user_id: user.id });
  if (erroDaAtivacao) {
    console.error(JSON.stringify({ level: "error", msg: "nova_senha_ativacao_falhou", code: erroDaAtivacao.code ?? "unknown" }));
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
