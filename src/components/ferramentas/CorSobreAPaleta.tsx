"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { contraste, veredito, type CorDaMarca } from "@/lib/cores/cores";
import { truncar2 } from "@/lib/paleta/contraste";
import { ContrasteDaPaleta } from "@/components/admin/ContrasteDaPaleta";

/**
 * A ponte da acessibilidade no Cores (07/11/2026) — só para quem tem a marca.
 *
 * O Cores já mede a cor da vez contra UMA cor de texto. Aqui ela é medida
 * contra TODAS as cores da paleta (a pergunta do dia a dia: "essa cor que eu
 * peguei na tela funciona sobre o fundo da marca?"), e a tabela completa da
 * paleta — a mesma da ficha, com os pares que se confundem no daltonismo —
 * abre logo abaixo, sem sair da ferramenta.
 *
 * É conta, sem IA. A razão é TRUNCADA em 2 casas, como na ficha da paleta e
 * no Vini: o número é o mesmo nas três telas. Cor em rascunho é medida, mas
 * identificada (CLAUDE.md, honestidade editorial). Aprovado e reprovado se
 * dizem por palavra e sinal (✓ / ✕), nunca só por cor.
 */
export function CorSobreAPaleta({ cor, paleta }: { cor: string; paleta: readonly CorDaMarca[] }) {
  const t = useTranslations("ferramentas.cores");
  const decimal = t("separadorDecimal");
  const medidas = useMemo(
    () => paleta.map((c) => {
      const razao = truncar2(contraste(cor, c.hex));
      return { c, razao, v: veredito(razao) };
    }),
    [cor, paleta],
  );
  const paraATabela = useMemo(
    () => paleta.map((c, i) => ({ nome: c.nome, hex: c.hex, status: c.status, papel: "apoio" as const, ordem: i })),
    [paleta],
  );
  if (paleta.length === 0) return null;

  const uso = (rotulo: string, valor: string) => (
    <td className="px-3 py-2 align-middle" data-passa={valor !== "falha" ? "sim" : "nao"}>
      <span className="text-[11px] text-platform-text-muted md:hidden">{rotulo} </span>
      <span className={valor !== "falha" ? "font-bold text-platform-text" : "text-platform-text-muted"}>
        {valor !== "falha" ? "✓" : "✕"} {t(`veredito.${valor}`)}
      </span>
    </td>
  );

  return (
    <section data-cores-sobre-a-paleta className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-platform-border bg-platform-panel p-4" aria-labelledby="titulo-sobre-a-paleta">
      <h2 id="titulo-sobre-a-paleta" className="font-display text-[17px] font-semibold tracking-tight text-platform-text">{t("sobreAPaleta.titulo")}</h2>
      <p className="text-[13px] leading-snug text-platform-text-muted">{t("sobreAPaleta.explicacao", { cor })}</p>
      <div className="overflow-x-auto border border-platform-border">
        <table className="w-full min-w-[560px] border-collapse text-sm" aria-label={t("sobreAPaleta.titulo")}>
          <thead className="border-b border-platform-border">
            <tr>
              {[t("sobreAPaleta.cabecalho.cor"), t("sobreAPaleta.cabecalho.razao"), t("selos.textoPequeno"), t("selos.textoGrande"), t("selos.iconesEBotoes")].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left font-display text-[10px] font-bold uppercase tracking-wider text-platform-text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-platform-border">
            {medidas.map(({ c, razao, v }) => (
              <tr key={`${c.nome}${c.hex}`} data-cor-sobre-a-paleta data-razao={razao.toFixed(2)} data-afirmado={c.status === "ready" ? "sim" : "nao"}>
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <span className="flex items-center gap-3">
                    <span aria-hidden className="inline-flex h-8 w-10 shrink-0 items-center justify-center border border-platform-border text-sm font-bold" style={{ backgroundColor: c.hex, color: cor }}>Aa</span>
                    <span className="min-w-0 text-platform-text">
                      {c.nome} <span className="font-mono text-[11px] text-platform-text-muted">{c.hex.toUpperCase()}</span>
                      {c.status !== "ready" && (
                        <span data-cor-em-rascunho className="ml-2 border border-dashed border-platform-border px-1.5 py-0.5 align-middle font-display text-[10px] font-bold uppercase tracking-wider text-platform-text-muted">{t("rascunho")}</span>
                      )}
                    </span>
                  </span>
                </th>
                <td className="px-3 py-2 align-middle font-mono font-bold text-platform-text">{razao.toFixed(2).replace(".", decimal)}:1</td>
                {uso(t("selos.textoPequeno"), v.textoPequeno)}
                {uso(t("selos.textoGrande"), v.textoGrande)}
                {uso(t("selos.iconesEBotoes"), v.iconesEBotoes)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details data-cores-tabela-da-paleta className="border border-platform-border px-4 py-3">
        <summary className="cursor-pointer text-sm font-bold text-platform-text">{t("sobreAPaleta.tabelaCompleta")}</summary>
        <ContrasteDaPaleta cores={paraATabela} />
      </details>
    </section>
  );
}
