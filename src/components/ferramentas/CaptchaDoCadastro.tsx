"use client";

import { useEffect, useRef } from "react";

/**
 * O Turnstile do cadastro gratuito (auditoria de 09/11/2026, A1). Só aparece quando
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` está configurada; sem ela o componente não renderiza nada e o
 * servidor também não exige captcha (as duas variáveis andam juntas: ver `/api/cadastro`).
 *
 * Sem texto próprio: o desafio da Cloudflare já fala o idioma do navegador. `aoMudar` recebe o
 * token quando a pessoa passa, ou null quando ele vence ou falha.
 */
const SCRIPT_DO_TURNSTILE = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type Turnstile = {
  render: (alvo: HTMLElement, opcoes: Record<string, unknown>) => string;
  remove: (id?: string) => void;
};

export const CHAVE_DO_CAPTCHA = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function CaptchaDoCadastro({ aoMudar }: { aoMudar: (token: string | null) => void }) {
  const alvo = useRef<HTMLDivElement>(null);
  const aviso = useRef(aoMudar);
  useEffect(() => { aviso.current = aoMudar; }, [aoMudar]);

  useEffect(() => {
    if (!CHAVE_DO_CAPTCHA) return;
    let id: string | null = null;
    const w = window as unknown as { turnstile?: Turnstile };
    const montar = () => {
      if (!w.turnstile || !alvo.current || id !== null) return;
      id = w.turnstile.render(alvo.current, {
        sitekey: CHAVE_DO_CAPTCHA, theme: "dark",
        callback: (valor: string) => aviso.current(valor),
        "expired-callback": () => aviso.current(null),
        "error-callback": () => aviso.current(null),
      });
    };
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_DO_TURNSTILE}"]`);
    if (w.turnstile) montar();
    else {
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_DO_TURNSTILE;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", montar);
    }
    return () => {
      script?.removeEventListener("load", montar);
      if (id !== null) w.turnstile?.remove(id);
    };
  }, []);

  if (!CHAVE_DO_CAPTCHA) return null;
  return <div ref={alvo} data-cadastro-captcha />;
}
