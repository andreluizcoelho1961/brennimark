"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

/**
 * "Esqueci a senha" — o pedido. A resposta do servidor é a mesma exista o
 * login ou não; a tela só a repete. Ver `@/lib/acesso/recuperacao`.
 */
export function PedidoDeNovaSenha() {
  const t = useTranslations("recuperacao");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<{ ok: boolean; texto: string } | null>(null);

  async function pedir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setResposta(null);
    const r = await fetch("/api/conta/esqueci-senha", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    }).catch(() => null);
    const dados = await r?.json().catch(() => ({})) as { message?: string } | undefined;
    setEnviando(false);
    setResposta({ ok: Boolean(r?.ok), texto: dados?.message ?? t("pedidoErro") });
  }

  const campo = "w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal";
  return (
    <div className="w-full max-w-sm" data-pedido-de-nova-senha>
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-platform-text">Brennimark</p>
      <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] text-platform-text">{t("pedidoTitulo")}</h1>
      {resposta?.ok ? (
        <p role="status" data-resposta-do-pedido className="mt-6 text-sm leading-relaxed text-platform-text-muted">{resposta.texto}</p>
      ) : (
        <form onSubmit={pedir} className="mt-6 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-platform-text-muted">
            {t("pedidoTexto")}
          </p>
          <label>
            <span className="sr-only">{t("pedidoEmail")}</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("pedidoPlaceholder")}
              autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={campo} />
          </label>
          <button type="submit" disabled={enviando}
            className="border border-platform-signal px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50">
            {enviando ? "…" : t("pedidoEnviar")}
          </button>
          {resposta && <p role="alert" data-resposta-do-pedido className="text-xs text-platform-text-muted">{resposta.texto}</p>}
        </form>
      )}
      <p className="mt-8 border-t border-platform-border pt-6 text-xs text-platform-text-muted">
        {t("lembrou")} <Link href="/login" className="underline">{t("entrar")}</Link>
      </p>
    </div>
  );
}
