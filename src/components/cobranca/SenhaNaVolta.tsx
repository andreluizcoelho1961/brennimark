"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { conferirSenhaNova } from "@/lib/acesso/senha-provisoria";
import type { Momento } from "@/lib/cobranca/senha-na-volta";

/**
 * A volta do pagamento (02/10/2026): pagou, cria a senha, entra.
 *
 * Quem decide em que momento a volta está é o servidor (`/api/cobranca/senha`),
 * que confere a prova do navegador antes de dizer qualquer coisa. Esta tela só
 * pergunta, espera o webhook do Stripe abrir a conta (segundos, no cartão) e
 * mostra o gesto certo para cada momento.
 *
 * Depois de criar a senha, quem abre a sessão é o navegador, como na tela de
 * login — a rota não abre sessão nenhuma.
 */
const INTERVALO_MS = 2500;
/** Quanto tempo esperar a conta nascer antes de parar de perguntar sozinho. */
const ESPERA_MAXIMA_MS = 180_000;

type Estado = Momento | "conferindo" | "demorou" | "falhou";

export function SenhaNaVolta({ sessao }: { sessao: string | null }) {
  const router = useRouter();
  const t = useTranslations("cobranca.volta");
  const [estado, setEstado] = useState<Estado>(sessao ? "conferindo" : "sem-prova");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const inicio = useRef(0);

  const conferir = useCallback(async (): Promise<Estado> => {
    const resposta = await fetch("/api/cobranca/senha", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessao, acao: "ver" }),
    }).catch(() => null);
    if (!resposta?.ok) return "falhou";
    const dados = await resposta.json().catch(() => ({})) as { momento?: Momento; email?: string | null };
    if (dados.email) setEmail(dados.email);
    return dados.momento ?? "falhou";
  }, [sessao]);

  useEffect(() => {
    if (!sessao) return;
    let vivo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    inicio.current = Date.now();
    const rodada = async () => {
      const momento = await conferir();
      if (!vivo) return;
      if (momento === "aguardando") {
        if (Date.now() - inicio.current > ESPERA_MAXIMA_MS) { setEstado("demorou"); return; }
        setEstado("aguardando");
        espera = setTimeout(rodada, INTERVALO_MS);
        return;
      }
      setEstado(momento);
    };
    void rodada();
    return () => { vivo = false; if (espera) clearTimeout(espera); };
  }, [sessao, conferir]);

  async function conferirDeNovo() {
    inicio.current = Date.now();
    setEstado("conferindo");
    const momento = await conferir();
    setEstado(momento === "aguardando" ? "demorou" : momento);
  }

  async function criar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");
    const recusa = conferirSenhaNova(senha, confirmacao);
    if (recusa) {
      setErro(t(recusa === "curta" ? "curta" : recusa === "longa" ? "longa" : "diferentes"));
      return;
    }
    setEnviando(true);
    const resposta = await fetch("/api/cobranca/senha", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessao, acao: "criar", senha, confirmacao }),
    }).catch(() => null);
    const dados = await resposta?.json().catch(() => ({})) as { message?: string; momento?: Momento; destino?: string; email?: string } | undefined;
    if (!resposta?.ok || !dados?.destino) {
      setEnviando(false);
      if (resposta?.status === 409 && dados?.momento) { setEstado(dados.momento); return; }
      setErro(dados?.message ?? t("falhouCriar"));
      return;
    }
    const { error } = await createClient().auth.signInWithPassword({ email: dados.email ?? email, password: senha });
    if (error) {
      // A senha foi criada; só a entrada automática falhou. O caminho é o login.
      setEnviando(false);
      setEstado("ja-tem-acesso");
      return;
    }
    router.replace(dados.destino);
    router.refresh();
  }

  const campo = "w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal";
  const rotulo = "mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted";
  const botao = "border border-platform-signal px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50";

  const titulo: Record<Estado, string> = {
    conferindo: t("titulos.pago"),
    aguardando: t("titulos.confirmando"),
    "criar-senha": t("titulos.criarSenha"),
    "ja-tem-acesso": t("titulos.pronta"),
    "sem-prova": t("titulos.pago"),
    expirado: t("titulos.pago"),
    demorou: t("titulos.confirmando"),
    falhou: t("titulos.pago"),
  };

  return (
    <div className="w-full max-w-md" data-volta-do-pagamento data-momento={estado}>
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-platform-text">Brennimark</p>
      <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] text-platform-text">{titulo[estado]}</h1>

      {(estado === "conferindo" || estado === "aguardando") && (
        <p role="status" className="mt-4 text-sm leading-relaxed text-platform-text-muted">
          {t("esperando")}
        </p>
      )}

      {estado === "demorou" && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-platform-text-muted">
            {t("demorou")}
          </p>
          <button type="button" onClick={conferirDeNovo} className={`${botao} self-start`}>{t("conferir")}</button>
        </div>
      )}

      {estado === "criar-senha" && (
        <form onSubmit={criar} data-form-senha-na-volta className="mt-6 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-platform-text-muted">
            {t("confirmado")}
          </p>
          <label>
            <span className={rotulo}>{t("email")}</span>
            <input type="email" value={email} readOnly autoComplete="username" className={`${campo} opacity-70`} />
          </label>
          <label>
            <span className={rotulo}>{t("senha")}</span>
            <input type="password" required autoComplete="new-password" value={senha}
              onChange={(e) => setSenha(e.target.value)} className={campo} />
          </label>
          <label>
            <span className={rotulo}>{t("repita")}</span>
            <input type="password" required autoComplete="new-password" value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)} className={campo} />
          </label>
          <p className="text-[12px] text-platform-text-muted">{t("minimo")}</p>
          <button type="submit" disabled={enviando} className={botao}>{enviando ? "…" : t("criar")}</button>
          {erro && <p role="alert" data-erro-da-senha className="text-xs text-platform-text-muted">{erro}</p>}
        </form>
      )}

      {estado === "ja-tem-acesso" && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-platform-text-muted">
            {email ? t.rich("entreCom", { email, b: (c) => <strong className="text-platform-text">{c}</strong> })
              : t("entreSemEmail")}
          </p>
          <Link href="/login" className={`${botao} self-start`}>{t("entrar")}</Link>
        </div>
      )}

      {(estado === "sem-prova" || estado === "expirado" || estado === "falhou") && (
        <p className="mt-4 text-sm leading-relaxed text-platform-text-muted" data-volta-sem-senha>
          {estado === "falhou"
            ? t("falhou")
            : estado === "expirado"
              ? t("expirado")
              : t("semProva")}
        </p>
      )}

      <p className="mt-8 border-t border-platform-border pt-6 text-xs text-platform-text-muted">
        {t("jaTem")} <Link href="/login" className="underline">{t("entrar")}</Link>
      </p>
    </div>
  );
}
