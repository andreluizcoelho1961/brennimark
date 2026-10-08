"use client";

import { useEffect, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import type { PedidoDeExportacao } from "@/lib/cobranca/exportacao";

const TITULO = "font-display text-sm font-black uppercase tracking-wider text-platform-text";
const BOTAO = "border border-platform-signal px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50";

/**
 * Configurações › Plano › Exportação (08/10/2026) — Termos, seção 13: quem
 * administra a conta pede, e a Brennimark entrega os arquivos originais e um
 * índice do conteúdo em até 15 dias. Um pedido aberto por vez: pedir de novo
 * mostra o que já está aberto.
 */
export function Exportacao() {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const [pedido, setPedido] = useState<PedidoDeExportacao | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await fetch(comAlvo("/api/configuracoes/exportacao", alvo), { cache: "no-store" }).catch(() => null);
      const corpo = r ? await r.json().catch(() => ({})) : {};
      if (!cancelado) setPedido(r?.ok ? (corpo.pedido ?? null) : null);
    })();
    return () => { cancelado = true; };
  }, [alvo]);

  async function pedir() {
    setEnviando(true);
    setErro("");
    const r = await fetch(comAlvo("/api/configuracoes/exportacao", alvo), { method: "POST" }).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (r?.ok) setPedido(corpo.pedido ?? null);
    else setErro(corpo.message ?? t("Couldn't send the request.", "Não foi possível enviar o pedido."));
  }

  const data = (iso: string) => new Intl.DateTimeFormat(isEnglish ? "en-US" : "pt-BR", { dateStyle: "long" }).format(new Date(iso));
  const aberto = pedido && !pedido.entregueEm;

  return (
    <section aria-labelledby="titulo-da-exportacao" data-exportacao>
      <h2 id="titulo-da-exportacao" className={TITULO}>{t("Export", "Exportação")}</h2>
      <p className="mt-2 max-w-[40rem] text-sm text-platform-text-muted">
        {t("A copy of everything that is yours: the original files and an index of the content, delivered within 15 days of the request.",
           "Uma cópia de tudo o que é seu: os arquivos originais e um índice do conteúdo, entregues em até 15 dias depois do pedido.")}
      </p>
      {aberto ? (
        <p data-exportacao-pedida role="status" className="mt-4 border-l-2 border-platform-text pl-3 text-sm font-bold text-platform-text">
          {t(`Requested on ${data(pedido.pedidoEm)}. We will deliver by ${data(pedido.prazo)}.`,
             `Pedido em ${data(pedido.pedidoEm)}. Entregamos até ${data(pedido.prazo)}.`)}
        </p>
      ) : (
        <>
          {pedido?.entregueEm && (
            <p data-exportacao-entregue className="mt-3 text-sm text-platform-text-muted">
              {t(`The last export was delivered on ${data(pedido.entregueEm)}.`, `A última exportação foi entregue em ${data(pedido.entregueEm)}.`)}
            </p>
          )}
          <button type="button" data-pedir-exportacao onClick={pedir} disabled={enviando || pedido === undefined} className={`${BOTAO} mt-4`}>
            {enviando ? t("Sending…", "Enviando…") : t("Request export", "Pedir exportação")}
          </button>
        </>
      )}
      {erro && <p role="alert" className="mt-3 text-sm text-platform-text">{erro}</p>}
    </section>
  );
}
