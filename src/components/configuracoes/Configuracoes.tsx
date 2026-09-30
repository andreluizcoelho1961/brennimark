"use client";

import { useIsEnglish } from "@/platform/locale-client";
import { Consumo } from "./Consumo";

/**
 * Configurações da conta (30/09/2026) — a subnavegação da seção (spec do
 * Studio §9.1: "Em Configurações: IA · Consumo · Plano · Aceites").
 *
 * "IA" não entra: a IA é da plataforma, e nenhuma conta a escolhe ou configura
 * (ADR-0008). Plano e Aceites aparecem apagados com "em breve", como na coluna
 * (decisão de 18/09): a pessoa vê o que vem, sem clicar numa tela vazia.
 */
export function Configuracoes() {
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const partes = [
    { id: "consumo", rotulo: t("Usage", "Consumo"), ativa: true },
    { id: "plano", rotulo: t("Plan", "Plano"), ativa: false },
    { id: "aceites", rotulo: t("Agreements", "Aceites"), ativa: false },
  ];

  return (
    <div data-configuracoes>
      <nav aria-label={t("Settings", "Configurações")} className="flex flex-wrap gap-1 border-b border-platform-border">
        {partes.map((p) => p.ativa ? (
          <span key={p.id} data-parte={p.id} aria-current="page" className="-mb-px border-b-2 border-platform-text px-3 py-2 text-sm font-bold text-platform-text">
            {p.rotulo}
          </span>
        ) : (
          <span key={p.id} data-parte-em-breve={p.id} aria-disabled="true" className="px-3 py-2 text-sm text-platform-text-muted opacity-60">
            {p.rotulo} <span className="text-[11px] uppercase tracking-wide">· {t("soon", "em breve")}</span>
          </span>
        ))}
      </nav>
      <div className="mt-8">
        <Consumo />
      </div>
    </div>
  );
}
