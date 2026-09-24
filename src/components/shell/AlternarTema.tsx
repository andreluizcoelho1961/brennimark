"use client";

import { useSyncExternalStore } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { CHAVE_DO_TEMA } from "@/platform/tokens";

/**
 * Claro ou escuro — fatia 6, decisão do André (24/09/2026): o claro ("papel")
 * é o padrão; o escuro ("estúdio") é opção de quem usa.
 *
 * A escolha fica no navegador da própria pessoa (conveniência de quem vê, não
 * dado do produto) e é aplicada ANTES da primeira pintura pelo script do
 * layout raiz. A página do manual nunca inverte: só a moldura troca.
 */
function assinar(avisar: () => void) {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
  return () => observador.disconnect();
}

export function AlternarTema() {
  const en = useIsEnglish();
  const escuro = useSyncExternalStore(assinar, () => document.documentElement.dataset.tema === "escuro", () => false);

  function alternar() {
    const proximo = !escuro;
    if (proximo) document.documentElement.dataset.tema = "escuro";
    else delete document.documentElement.dataset.tema;
    try {
      if (proximo) localStorage.setItem(CHAVE_DO_TEMA, "escuro");
      else localStorage.removeItem(CHAVE_DO_TEMA);
    } catch {
      // Armazenamento bloqueado: vale só nesta página, e está tudo bem.
    }
  }

  const rotulo = escuro ? (en ? "Switch to light theme" : "Usar o tema claro") : (en ? "Switch to dark theme" : "Usar o tema escuro");
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={escuro}
      aria-label={rotulo}
      title={rotulo}
      data-alternar-tema
      className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
    >
      <span aria-hidden className="text-[15px] leading-none">◐</span>
    </button>
  );
}
