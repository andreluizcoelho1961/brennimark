"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ACEITES, idiomaDoCadastro } from "@/lib/cadastro/cadastro";

/**
 * A entrada no tour (25/10/2026): nome, e-mail, a caixa de marketing (separada e
 * desmarcada) e o Turnstile. Quem passa cai no manual de demonstração; o servidor
 * cria a sessão e diz o destino (`/api/demonstracao/entrar`).
 *
 * O Turnstile fora de produção usa a chave de teste pública da Cloudflare, que
 * sempre passa; em produção, sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY` o botão fica
 * desligado — o tour nunca abre sem captcha.
 */
const SCRIPT_DO_TURNSTILE = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const CHAVE_DE_TESTE = "1x00000000000000000000AA";

type Turnstile = {
  render: (alvo: HTMLElement, opcoes: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

function chaveDoSite(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || (process.env.NODE_ENV === "production" ? "" : CHAVE_DE_TESTE);
}

export function EntradaNoTour() {
  const t = useTranslations("demonstracao");
  const locale = useLocale();
  const idioma = idiomaDoCadastro(locale === "en" ? "en" : "pt-BR");
  const chave = chaveDoSite();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [aceite, setAceite] = useState(false);
  const [website, setWebsite] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [captchaFalhou, setCaptchaFalhou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const alvoDoCaptcha = useRef<HTMLDivElement>(null);
  const idDoWidget = useRef<string | null>(null);

  const montarCaptcha = useCallback(() => {
    if (!window.turnstile || !alvoDoCaptcha.current || idDoWidget.current !== null) return;
    idDoWidget.current = window.turnstile.render(alvoDoCaptcha.current, {
      sitekey: chave,
      theme: "dark",
      language: locale === "en" ? "en" : "pt-br",
      callback: (valor: string) => setToken(valor),
      "expired-callback": () => setToken(null),
      "error-callback": () => { setToken(null); setCaptchaFalhou(true); },
    });
  }, [chave, locale]);

  useEffect(() => {
    if (!chave) return;
    if (window.turnstile) { montarCaptcha(); return; }
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_DO_TURNSTILE}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_DO_TURNSTILE;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const aoCarregar = () => montarCaptcha();
    const aoFalhar = () => setCaptchaFalhou(true);
    script.addEventListener("load", aoCarregar);
    script.addEventListener("error", aoFalhar);
    return () => { script?.removeEventListener("load", aoCarregar); script?.removeEventListener("error", aoFalhar); };
  }, [chave, montarCaptcha]);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    if (!token) { setErro(captchaFalhou || !chave ? t("captchaFalhou") : t("captchaPendente")); return; }
    setEnviando(true);
    setErro(null);
    const r = await fetch("/api/demonstracao/entrar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, aceiteMarketing: aceite, idioma, token, website }),
    }).catch(() => null);
    const dados = await r?.json().catch(() => null) as { ok?: boolean; destino?: string; message?: string } | null;
    if (r?.ok && dados?.destino) {
      window.location.assign(dados.destino);
      return;
    }
    // O token vale uma vez: depois de uma tentativa, o widget precisa de outro.
    setToken(null);
    if (idDoWidget.current !== null) window.turnstile?.reset(idDoWidget.current);
    setErro(dados?.message ?? t(r ? "erroGeral" : "indisponivel"));
    setEnviando(false);
  }

  const campo = "w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal";
  return (
    <div className="w-full max-w-md" data-entrada-no-tour>
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-platform-text">Brennimark</p>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-platform-text-muted">{t("kicker")}</p>
      <h1 className="mt-2 font-display text-3xl font-black uppercase leading-[0.95] text-platform-text">{t("titulo")}</h1>
      <p className="mt-4 text-sm leading-relaxed text-platform-text-muted">{t("texto")}</p>
      <ul className="mt-4 flex flex-col gap-1.5 text-sm text-platform-text">
        <li>— {t("item1")}</li>
        <li>— {t("item2")}</li>
        <li>— {t("item3")}</li>
      </ul>

      <form onSubmit={entrar} className="mt-6 flex flex-col gap-4" noValidate={false}>
        <label>
          <span className="sr-only">{t("nome")}</span>
          <input data-tour-nome type="text" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
            placeholder={t("nome")} autoComplete="name" className={campo} />
        </label>
        <label>
          <span className="sr-only">{t("email")}</span>
          <input data-tour-email type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={campo} />
        </label>
        {/* A isca de robô: pessoa nenhuma vê nem preenche. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)}
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
        <label className="flex items-start gap-3 text-xs leading-relaxed text-platform-text-muted">
          <input data-tour-aceite type="checkbox" className="mt-0.5" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
          <span>{ACEITES[idioma].texto}</span>
        </label>
        <div ref={alvoDoCaptcha} data-tour-captcha className="min-h-[65px]" />
        <button data-tour-enviar type="submit" disabled={enviando || !chave}
          className="border border-platform-signal px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50">
          {enviando ? t("enviando") : t("enviar")}
        </button>
        {erro && <p data-tour-erro role="alert" className="text-xs text-platform-text">{erro}</p>}
      </form>

      <p className="mt-6 text-xs leading-relaxed text-platform-text-muted">
        {t.rich("privacidade", { link: (trecho) => <Link href="/privacidade" className="underline">{trecho}</Link> })}
      </p>
      <p className="mt-6 border-t border-platform-border pt-6 text-xs text-platform-text-muted">
        {t("jaAssina")} <Link href="/login" className="underline">{t("entrar")}</Link>
      </p>
    </div>
  );
}
