"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useIsEnglish } from "@/platform/locale-client";
import { Consumo } from "./Consumo";
import { Plano } from "./Plano";

/**
 * Configurações da conta (30/09/2026) — a subnavegação da seção (spec do
 * Studio §9.1: "Em Configurações: IA · Consumo · Plano · Aceites").
 *
 * "IA" não entra: a IA é da plataforma, e nenhuma conta a escolhe ou configura
 * (ADR-0008). Aceites aparece apagado com "em breve", como na coluna
 * (decisão de 18/09): a pessoa vê o que vem, sem clicar numa tela vazia.
 *
 * Plano entrou em 01/10/2026 (cobrança, fatia 3). `?parte=plano` abre direto
 * nele — é para onde o Portal do Stripe devolve a pessoa.
 */
type Parte = "consumo" | "plano";

export function Configuracoes() {
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const inicial = useSearchParams().get("parte") === "plano" ? "plano" : "consumo";
  const [atual, setAtual] = useState<Parte>(inicial);
  const partes: { id: string; rotulo: string; ativa: boolean }[] = [
    { id: "consumo", rotulo: t("Usage", "Consumo"), ativa: true },
    { id: "plano", rotulo: t("Plan", "Plano"), ativa: true },
    { id: "aceites", rotulo: t("Agreements", "Aceites"), ativa: false },
  ];

  return (
    <div data-configuracoes>
      <nav aria-label={t("Settings", "Configurações")} className="flex flex-wrap gap-1 border-b border-platform-border">
        {partes.map((p) => p.ativa ? (
          <button key={p.id} type="button" data-parte={p.id} aria-current={atual === p.id ? "page" : undefined}
            onClick={() => setAtual(p.id as Parte)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${atual === p.id ? "border-platform-text font-bold text-platform-text" : "border-transparent text-platform-text-muted hover:text-platform-text"}`}>
            {p.rotulo}
          </button>
        ) : (
          <span key={p.id} data-parte-em-breve={p.id} aria-disabled="true" className="px-3 py-2 text-sm text-platform-text-muted opacity-60">
            {p.rotulo} <span className="text-[11px] uppercase tracking-wide">· {t("soon", "em breve")}</span>
          </span>
        ))}
      </nav>
      <div className="mt-8">
        {atual === "plano" ? <Plano /> : <Consumo />}
      </div>
    </div>
  );
}
