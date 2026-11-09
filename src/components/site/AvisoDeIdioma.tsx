"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

/**
 * O aviso de "esta página ainda não existe no outro idioma".
 *
 * Quem pede `/en/vini` e a página ainda não foi traduzida cai em `/vini?idioma=indisponivel`
 * (o `proxy` faz o desvio). Esta faixa explica por que a página está em português,
 * nos DOIS idiomas, porque quem pediu inglês pode não ler o aviso em português.
 *
 * Lê a query no navegador (`useSyncExternalStore`, com `false` no servidor), e
 * não pelo servidor: a página é gerada no deploy, igual para todos, e ler a
 * query a tornaria dinâmica.
 */
function assinar(aviso: () => void) {
  window.addEventListener("popstate", aviso);
  return () => window.removeEventListener("popstate", aviso);
}

export function AvisoDeIdioma() {
  const t = useTranslations("site.idioma");
  const pedido = useSyncExternalStore(
    assinar,
    () => new URLSearchParams(window.location.search).get("idioma") === "indisponivel",
    () => false,
  );
  const [fechado, setFechado] = useState(false);
  if (!pedido || fechado) return null;
  return (
    <div className="idioma-aviso" role="status" data-aviso-de-idioma>
      <p>
        <span lang="en">{t("avisoIngles")}</span>
        <br />
        <span lang="pt-BR">{t("avisoPortugues")}</span>
      </p>
      <button type="button" onClick={() => setFechado(true)} aria-label={t("fechar")}>×</button>
    </div>
  );
}
