"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { sugerirAjuste, type CorAprovada, type UsoDoPar } from "@/lib/cores/acessibilidade-da-peca";

/**
 * O ajuste com as cores da marca no Cores (07/11/2026) — só para o assinante.
 *
 * Quando o par texto/fundo da tela não passa para o uso escolhido, mostra até
 * 3 cores APROVADAS da paleta que o resolveriam, trocando o texto ou o fundo,
 * as mais próximas da atual primeiro. Nunca sai cor de fora da marca: se
 * nenhuma resolve, a tela diz isso (a regra do André — acessibilidade se
 * corrige com as cores da própria marca, não com um tom que a marca não tem).
 * Rascunho nunca entra como sugestão. É conta, sem IA; a lógica é a mesma do
 * ajuste da peça no Vini (`sugerirAjuste`).
 */
const USOS: UsoDoPar[] = ["texto-comum", "texto-grande", "icones-e-botoes"];

export function AjusteComCoresDaMarca({ texto, fundo, paleta }: { texto: string; fundo: string; paleta: readonly CorAprovada[] }) {
  const t = useTranslations("ferramentas.cores");
  const [uso, setUso] = useState<UsoDoPar>("texto-comum");
  const ajuste = useMemo(() => sugerirAjuste(texto, fundo, uso, paleta), [texto, fundo, uso, paleta]);
  const decimal = t("separadorDecimal");

  const lista = (alvo: "texto" | "fundo") => {
    if (ajuste.estado !== "sugestoes") return null;
    const itens = ajuste.sugestoes.filter((s) => s.alvo === alvo);
    if (itens.length === 0) return null;
    return (
      <div>
        <p className="mb-1 text-[12px] text-platform-text-muted">{alvo === "texto" ? t("ajuste.trocarTexto") : t("ajuste.trocarFundo")}</p>
        <ul className="flex flex-col gap-1.5">
          {itens.map((s) => (
            <li key={`${alvo}${s.hex}`} data-cores-sugestao={alvo} data-hex={s.hex} className="flex items-center gap-2 text-[13px] text-platform-text">
              <span aria-hidden className="inline-flex h-7 w-9 shrink-0 items-center justify-center border border-platform-border text-[12px] font-bold"
                style={{ backgroundColor: alvo === "texto" ? fundo : s.hex, color: alvo === "texto" ? s.hex : texto }}>Aa</span>
              <span className="min-w-0">{s.nome} <span className="font-mono text-[11px] text-platform-text-muted">{s.hex}</span></span>
              <span className="ml-auto font-mono font-bold">{s.razao.toFixed(2).replace(".", decimal)}:1</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div data-cores-ajuste className="flex flex-col gap-2 border-t border-platform-border pt-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-platform-text-muted">{t("ajuste.titulo")}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("ajuste.usoAria")}>
        {USOS.map((u) => (
          <button key={u} type="button" data-cores-ajuste-uso={u} aria-pressed={uso === u} onClick={() => setUso(u)}
            className={`rounded-full border px-2.5 py-1 text-[12.5px] ${uso === u ? "border-platform-text text-platform-text" : "border-platform-border text-platform-text-muted"}`}>
            {t(`ajuste.usos.${u}`)}
          </button>
        ))}
      </div>
      {ajuste.estado === "ja-passa" && <p data-cores-ajuste-estado="ja-passa" className="text-[13px] text-platform-text">✓ {t("ajuste.jaPassa")}</p>}
      {ajuste.estado === "sem-paleta" && <p data-cores-ajuste-estado="sem-paleta" className="text-[13px] text-platform-text-muted">{t("ajuste.semPaleta")}</p>}
      {ajuste.estado === "nenhuma" && <p data-cores-ajuste-estado="nenhuma" className="text-[13px] text-platform-text">{t("ajuste.nenhuma")}</p>}
      {ajuste.estado === "sugestoes" && <div data-cores-ajuste-estado="sugestoes" className="flex flex-col gap-3">{lista("texto")}{lista("fundo")}</div>}
      <p className="text-[11.5px] leading-snug text-platform-text-muted">{t("ajuste.nota")}</p>
    </div>
  );
}
