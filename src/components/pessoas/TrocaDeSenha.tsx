"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useIsEnglish } from "@/platform/locale-client";
import { platformIdentity } from "@/platform/identity";
import { conferirSenhaNova } from "@/lib/acesso/senha-provisoria";

/**
 * A troca da senha provisória — a única tela aberta a quem ainda tem uma.
 *
 * A moldura desvia para cá qualquer endereço (`desvioDaSenhaProvisoria`), e o
 * banco não dá acesso antes da troca. Esta tela só precisa acertar o gesto:
 * dizer até quando a senha vale, conferir a nova antes de enviar, e, vencida,
 * dizer a quem pedir outra.
 *
 * Os dados chegam do servidor (`app/trocar-senha/page.tsx`), lidos da sessão;
 * a bancada `/dev/trocar-senha` os finge para a suíte de navegador.
 */
export function TrocaDeSenha({
  email, validaAte, vencida, porLink = false,
}: {
  email: string; validaAte: string; vencida: boolean;
  /** Quem assinou pelo site entra pelo LINK de primeiro acesso, que a equipe
   *  da Brennimark gera (cobrança, 01/10/2026): não recebeu senha nenhuma. */
  porLink?: boolean;
}) {
  const isEnglish = useIsEnglish();
  const router = useRouter();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [trocou, setTrocou] = useState(false);

  const prazo = new Date(validaAte).toLocaleString(isEnglish ? "en-GB" : "pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  async function trocar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");

    const recusa = conferirSenhaNova(senha, confirmacao);
    if (recusa) {
      setErro(recusa === "curta" ? t("A senha precisa de ao menos 12 caracteres.", "The password needs at least 12 characters.")
        : recusa === "longa" ? t("A senha passou do tamanho máximo.", "The password is too long.")
        : t("As duas senhas não são iguais.", "The two passwords don't match."));
      return;
    }

    setEnviando(true);
    const resposta = await fetch("/api/conta/trocar-senha", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha, confirmacao }),
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      setEnviando(false);
      setErro(dados.message ?? t("Não foi possível trocar a senha.", "Couldn't change the password."));
      return;
    }

    // O token da sessão ainda diz "provisória"; renovado, ele passa a dizer o
    // que o provedor diz agora. O `refresh` faz a moldura decidir de novo.
    setTrocou(true);
    await createClient().auth.refreshSession().catch(() => undefined);
    router.replace("/");
    router.refresh();
  }

  async function sair() {
    await createClient().auth.signOut().catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  const campo = "w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal";

  return (
    <div className="w-full max-w-sm">
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-platform-text">
        {platformIdentity.displayName}
      </p>
      <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] text-platform-text">
        {vencida
          ? (porLink ? t("O prazo para criar a senha venceu", "The time to create your password expired") : t("A senha provisória venceu", "The temporary password expired"))
          : t("Crie a sua senha", "Create your password")}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-platform-text-muted">
        {t("Entrou como", "Signed in as")} <strong className="text-platform-text">{email}</strong>
      </p>

      {vencida ? (
        <div data-senha-vencida className="mt-6 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-platform-text-muted">
            {porLink
              ? t(`Valia até ${prazo}. Peça um novo link de acesso à equipe da Brennimark.`,
                  `It was valid until ${prazo}. Ask the Brennimark team for a new access link.`)
              : t(
              `Ela valia até ${prazo}. Peça uma nova a quem administra a conta — a pessoa gera outra na tela Pessoas e acesso.`,
              `It was valid until ${prazo}. Ask your account administrator for a new one — they can generate it in People & access.`,
            )}
          </p>
          <button type="button" onClick={sair}
            className="border border-platform-border px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-platform-text">
            {t("Sair", "Sign out")}
          </button>
        </div>
      ) : (
        <form onSubmit={trocar} data-form-troca className="mt-6 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-platform-text-muted">
            {porLink
              ? t(`Você entrou pelo link de primeiro acesso. Crie a sua senha até ${prazo} para usar a conta.`,
                  `You signed in with your first-access link. Create your password by ${prazo} to use the account.`)
              : t(
              `A senha que você recebeu é provisória e vale até ${prazo}. Escolha uma sua para liberar o acesso.`,
              `The password you received is temporary and valid until ${prazo}. Choose your own to unlock access.`,
            )}
          </p>
          <label>
            <span className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted">
              {t("Nova senha", "New password")}
            </span>
            <input type="password" required autoComplete="new-password" value={senha}
              onChange={(e) => setSenha(e.target.value)} className={campo} />
          </label>
          <label>
            <span className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted">
              {t("Repita a nova senha", "Repeat the new password")}
            </span>
            <input type="password" required autoComplete="new-password" value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)} className={campo} />
          </label>
          <p className="text-[12px] text-platform-text-muted">{t("Ao menos 12 caracteres.", "At least 12 characters.")}</p>
          <p className="text-[12px] leading-relaxed text-platform-text-muted" data-aceite-dos-termos>
            {t("Ao continuar, você aceita os ", "By continuing, you accept the ")}
            <a href="/termos" target="_blank" rel="noopener" className="underline">{t("Termos de uso", "Terms of use")}</a>
            {t(" e a ", " and the ")}
            <a href="/privacidade" target="_blank" rel="noopener" className="underline">{t("Política de privacidade", "Privacy policy")}</a>.
          </p>
          <button type="submit" disabled={enviando}
            className="border border-platform-signal px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50">
            {enviando ? "…" : t("Salvar e entrar", "Save and continue")}
          </button>
          {erro && <p role="alert" data-erro-da-troca className="text-xs text-platform-text-muted">{erro}</p>}
          {trocou && <p role="status" className="text-xs text-platform-text-muted">{t("Senha trocada. Entrando…", "Password changed. Signing in…")}</p>}
          <button type="button" onClick={sair} className="self-start text-[12px] text-platform-text-muted underline">
            {t("Sair", "Sign out")}
          </button>
        </form>
      )}
    </div>
  );
}
