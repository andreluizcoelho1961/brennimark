"use client";

import { useEffect } from "react";
import { COOKIE_DE_IDIOMA } from "@/platform/locale";
import type { IdiomaDoSite } from "@/lib/site/idiomas";

/** Grava o idioma como preferência deste navegador: a plataforma (login, assinar, produto) o lê. */
export function gravarIdiomaDoNavegador(idioma: IdiomaDoSite) {
  try {
    document.cookie = `${COOKIE_DE_IDIOMA}=${idioma}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch { /* sem cookie: a plataforma cai no navegador, como sempre */ }
}

/**
 * O idioma do site é o do ENDEREÇO, mas as páginas da plataforma (assinar,
 * entrar, o produto) têm outra raiz e leem o cookie. Sem esta ponte, quem
 * lê o site em inglês e clica em "Subscribe" cairia no idioma do navegador.
 *
 * Só grava quando AINDA NÃO há escolha: quem já escolheu no botão da
 * plataforma não perde a escolha por ter passado pelo site. A escolha feita
 * no botão de idioma do site grava por cima (`SeletorDeIdiomaDoSite`).
 */
export function LembrarIdiomaDoSite({ idioma }: { idioma: IdiomaDoSite }) {
  useEffect(() => {
    try {
      if (!document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE_DE_IDIOMA}=`))) gravarIdiomaDoNavegador(idioma);
    } catch { /* idem */ }
  }, [idioma]);
  return null;
}
