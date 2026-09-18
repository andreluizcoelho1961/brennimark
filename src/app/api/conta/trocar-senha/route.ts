import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { conferirSenhaNova, senhaProvisoriaAte, senhaProvisoriaVencida } from "@/lib/acesso/senha-provisoria";

/**
 * A troca da senha provisória — e só depois dela, o acesso.
 *
 * O banco não dá acesso a login com senha provisória
 * (`supabase/migrations/…_senha_provisoria.sql`). Esta rota é o único caminho
 * de saída: confere o PRAZO, troca a senha e apaga a marca de provisória no
 * mesmo pedido ao provedor, e só então pede ao banco que ative
 * (`public.ativar_login`, que só a chave de serviço chama e que recusa se a
 * marca ainda estiver lá).
 *
 * Quem confere o prazo é esta rota, e não o banco: a senha vencida continua
 * abrindo sessão no provedor, mas não dá acesso a nada, e daqui não sai.
 *
 * A senha nova não vai para log, nem para a resposta.
 */
const isEnglish = inEnglish(PRODUCT_LOCALE);
const t = (pt: string, en: string) => (isEnglish ? en : pt);

export async function POST(request: Request) {
  const supabase = await createClient();
  // `getUser` valida a sessão no provedor e devolve o `app_metadata` ATUAL —
  // não o que ficou gravado no token quando a pessoa entrou.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: t("Entre de novo.", "Sign in again.") }, { status: 401 });
  }

  const corpo = await request.json().catch(() => null);
  const ate = senhaProvisoriaAte(user.app_metadata);

  if (ate) {
    if (senhaProvisoriaVencida(ate)) {
      return NextResponse.json({
        message: t(
          "Esta senha provisória venceu. Peça uma nova a quem administra a conta.",
          "This temporary password has expired. Ask your account administrator for a new one.",
        ),
      }, { status: 410 });
    }

    const recusa = conferirSenhaNova(corpo?.senha, corpo?.confirmacao);
    if (recusa) {
      const frases = {
        curta: ["A senha precisa de ao menos 12 caracteres.", "The password needs at least 12 characters."],
        longa: ["A senha passou do tamanho máximo.", "The password is too long."],
        diferentes: ["As duas senhas não são iguais.", "The two passwords don't match."],
      } as const;
      return NextResponse.json({ message: t(frases[recusa][0], frases[recusa][1]) }, { status: 400 });
    }

    // Senha e marca no MESMO pedido: não existe instante em que a senha já é a
    // nova e a marca ainda diz "provisória", nem o contrário.
    const { error } = await createServiceClient().auth.admin.updateUserById(user.id, {
      password: corpo.senha,
      app_metadata: { senha_provisoria_ate: null },
    });
    if (error) {
      console.error(JSON.stringify({ level: "error", msg: "troca_de_senha_falhou", code: error.code ?? "unknown" }));
      const fraca = error.code === "weak_password";
      return NextResponse.json({
        message: fraca
          ? t("Esta senha é fácil demais de adivinhar. Escolha outra.", "This password is too easy to guess. Choose another.")
          : t("Não foi possível trocar a senha.", "Couldn't change the password."),
      }, { status: fraca ? 400 : 502 });
    }
  }

  // Sem marca de provisória também se ativa: cobre quem trocou a senha e teve
  // a ativação interrompida. `ativar_login` é idempotente — o que já virou
  // acesso não vira de novo.
  const { error: erroDaAtivacao } = await createServiceClient().rpc("ativar_login", { p_user_id: user.id });
  if (erroDaAtivacao) {
    console.error(JSON.stringify({ level: "error", msg: "ativacao_falhou", code: erroDaAtivacao.code ?? "unknown" }));
    return NextResponse.json({
      message: t(
        "A senha foi trocada, mas o acesso não foi liberado. Tente de novo em instantes.",
        "The password was changed, but access wasn't granted yet. Try again in a moment.",
      ),
    }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
