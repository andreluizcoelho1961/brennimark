"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { conferirSenhaNova } from "@/lib/acesso/senha-provisoria";
import { DESTINO_PADRAO } from "@/platform/destino-de-retorno";

/**
 * "Esqueci a senha" — a troca, aberta pelo link do e-mail. O segredo do
 * endereço vai junto no pedido; o servidor o confere (`@/lib/acesso/recuperacao`).
 */
export function NovaSenha({ email, segredo }: { email: string; segredo: string | null }) {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [vencido, setVencido] = useState(segredo === null);

  async function trocar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");
    const recusa = conferirSenhaNova(senha, confirmacao);
    if (recusa) {
      setErro(recusa === "curta" ? "A senha precisa de ao menos 12 caracteres."
        : recusa === "longa" ? "A senha passou do tamanho máximo." : "As duas senhas não são iguais.");
      return;
    }
    setEnviando(true);
    const r = await fetch("/api/conta/nova-senha", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ segredo, senha, confirmacao }),
    }).catch(() => null);
    const dados = await r?.json().catch(() => ({})) as { message?: string } | undefined;
    if (!r?.ok) {
      setEnviando(false);
      if (r?.status === 410) { setVencido(true); return; }
      setErro(dados?.message ?? "Não foi possível trocar a senha. Tente de novo.");
      return;
    }
    // O token da sessão foi emitido antes da troca; renovado, a moldura decide de novo.
    await createClient().auth.refreshSession().catch(() => undefined);
    router.replace(DESTINO_PADRAO);
    router.refresh();
  }

  const campo = "w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal";
  const rotulo = "mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted";
  return (
    <div className="w-full max-w-sm" data-nova-senha>
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-platform-text">Brennimark</p>
      <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] text-platform-text">
        {vencido ? "Este link não vale mais" : "Crie uma nova senha"}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-platform-text-muted">
        Para <strong className="text-platform-text">{email}</strong>
      </p>
      {vencido ? (
        <p data-link-vencido className="mt-6 text-sm leading-relaxed text-platform-text-muted">
          O link serve uma vez e vale por uma hora. <Link href="/esqueci-senha" className="underline">Peça outro</Link>.
        </p>
      ) : (
        <form onSubmit={trocar} data-form-nova-senha className="mt-6 flex flex-col gap-4">
          <label>
            <span className={rotulo}>Nova senha</span>
            <input type="password" required autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} />
          </label>
          <label>
            <span className={rotulo}>Repita a nova senha</span>
            <input type="password" required autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} className={campo} />
          </label>
          <p className="text-[12px] text-platform-text-muted">Ao menos 12 caracteres.</p>
          <button type="submit" disabled={enviando}
            className="border border-platform-signal px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50">
            {enviando ? "…" : "Salvar e entrar"}
          </button>
          {erro && <p role="alert" data-erro-da-nova-senha className="text-xs text-platform-text-muted">{erro}</p>}
        </form>
      )}
    </div>
  );
}
