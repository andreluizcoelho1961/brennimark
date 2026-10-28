"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { localeDeFormato } from "@/platform/locale";
import { CHAVE_DE_VISTO, EVENTO_DO_TOUR, jaFoiVisto } from "@/lib/demonstracao/passos-do-tour";
import { TourGuiado } from "./TourGuiado";
import { useIsEnglish } from "@/platform/locale-client";

type Estado = { restantes: number; expiraEm: string | null };

async function lerEstado(): Promise<Estado | null> {
  const r = await fetch("/api/demonstracao/estado", { cache: "no-store" }).catch(() => null);
  const d = r?.ok ? await r.json().catch(() => null) as { visitante?: boolean; restantes?: number; expiraEm?: string | null } | null : null;
  return d?.visitante && typeof d.restantes === "number" ? { restantes: d.restantes, expiraEm: d.expiraEm ?? null } : null;
}

/**
 * A faixa do tour na moldura (25/10/2026): só aparece para o visitante do tour
 * (a rota diz quem é) e mostra quantas perguntas ao Vini ainda restam. Quem
 * assina nunca a vê. O caminho para assinar está nela.
 */
export function FaixaDoTour() {
  // Sem `useTranslations`: a faixa mora na moldura, que nem sempre tem o provedor de traduções
  // (só as páginas de manual têm). Mesmo padrão do aviso de cobrança.
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [guiado, setGuiado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const atualizar = (primeira = false) => {
      void lerEstado().then((e) => {
        if (cancelado) return;
        setEstado(e);
        if (!primeira || !e) return;
        // A primeira visita abre o tour guiado; depois, só pelo botão da faixa. Guardar é conveniência: sem armazenamento, ele abre de novo.
        let visto = false;
        try { visto = jaFoiVisto(window.localStorage.getItem(CHAVE_DE_VISTO)); } catch { /* sem armazenamento */ }
        if (!visto) setGuiado(true);
      });
    };
    atualizar(true);
    const aoAtualizar = () => atualizar();
    window.addEventListener(EVENTO_DO_TOUR, aoAtualizar);
    return () => { cancelado = true; window.removeEventListener(EVENTO_DO_TOUR, aoAtualizar); };
  }, []);

  if (!estado) return null;
  const quando = estado.expiraEm
    ? new Intl.DateTimeFormat(localeDeFormato(isEnglish), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(estado.expiraEm))
    : null;

  const perguntas = estado.restantes === 0
    ? t("Your questions to Vini are used up", "Suas perguntas ao Vini acabaram")
    : estado.restantes === 1
      ? t("1 question to Vini left", "Resta 1 pergunta ao Vini")
      : t(`${estado.restantes} questions to Vini left`, `Restam ${estado.restantes} perguntas ao Vini`);

  return (
    <div data-faixa-do-tour role="status"
      className="mx-auto mb-3 flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-1 border-l-2 border-platform-signal bg-platform-panel px-4 py-2 text-sm text-platform-text">
      <span className="font-bold">{t("You're in the demo tour", "Você está no tour de demonstração")}</span>
      <span data-faixa-do-tour-perguntas>{perguntas}</span>
      {quando && <span className="text-platform-text-muted">{t(`The tour is valid until ${quando}.`, `O tour vale até ${quando}.`)}</span>}
      <button type="button" data-tour-reabrir onClick={() => setGuiado(true)} className="underline">{t("Guided tour", "Tour guiado")}</button>
      <Link href="/assinar" className="underline">{t("Subscribe to Brennimark", "Assine o Brennimark")}</Link>
      {guiado && (
        <TourGuiado ingles={isEnglish} aoFechar={() => {
          setGuiado(false);
          try { window.localStorage.setItem(CHAVE_DE_VISTO, "1"); } catch { /* sem armazenamento */ }
        }} />
      )}
    </div>
  );
}
