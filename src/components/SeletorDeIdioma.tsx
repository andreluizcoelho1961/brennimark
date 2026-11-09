"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductLocale } from "@/platform/locale";
import { useLocale } from "@/platform/locale-client";

/**
 * O botão de idioma da interface.
 *
 * Um botão só, que mostra o idioma PARA O QUAL se troca: em português mostra
 * "EN", em inglês mostra "PT". Dois botões lado a lado passavam 17 px da
 * largura de um celular de 320 px na barra de cima (smoke de overflow).
 *
 * O nome de cada idioma aparece NA LÍNGUA DELE, e não na da tela: quem abriu o
 * produto num idioma que não lê precisa reconhecer o seu para sair dele.
 * Grava pela rota `/api/idioma` (cookie e, havendo sessão, o perfil) e pede ao
 * servidor para redesenhar a tela.
 */
const NOMES: Record<ProductLocale, { curto: string; completo: string }> = {
  "pt-BR": { curto: "PT", completo: "Português" },
  en: { curto: "EN", completo: "English" },
};

export function SeletorDeIdioma() {
  const atual = useLocale();
  const router = useRouter();
  const [gravando, setGravando] = useState(false);
  const destino: ProductLocale = atual === "en" ? "pt-BR" : "en";

  async function trocar() {
    if (gravando) return;
    setGravando(true);
    try {
      await fetch("/api/idioma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: destino }),
      });
      router.refresh();
    } finally {
      setGravando(false);
    }
  }

  return (
    <button
      type="button"
      lang={destino}
      title={NOMES[destino].completo}
      aria-label={NOMES[destino].completo}
      disabled={gravando}
      onClick={trocar}
      data-seletor-de-idioma
      className="flex h-11 items-center rounded-[var(--radius-control)] px-2 text-[11px] font-medium tracking-wide text-platform-text-muted transition-colors duration-[var(--motion-control)] hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus disabled:opacity-50 sm:h-8"
    >
      {NOMES[destino].curto}
    </button>
  );
}
