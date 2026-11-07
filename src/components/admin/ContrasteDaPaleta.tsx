"use client";

import { useId, useMemo } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import {
  contrastesDaPaleta, paresQueSeConfundem, LIMITE_ICONES_E_BOTOES, LIMITE_TEXTO_COMUM, LIMITE_TEXTO_GRANDE,
  type CorMedida, type Extremo, type ParMedido,
} from "@/lib/paleta/contraste";

/**
 * O contraste da paleta — fatia 1 de acessibilidade (06/11/2026).
 *
 * A tabela é CONTA, não opinião: cada par de cores da ficha, e cada cor sobre
 * branco e preto, com a razão de contraste e o veredito por uso. Sem IA: vale
 * em qualquer plano. O Vini lê a mesma conta (`trechosDoContraste`).
 *
 * Moldura da plataforma, acromática (ADR-0004): aprovado e reprovado se dizem
 * pela palavra e pelo sinal (✓ / ✕), nunca por verde e vermelho — a tabela
 * também serve a quem não distingue essas cores. A ÚNICA cor da marca aqui é a
 * amostra "Aa" de cada par, que é conteúdo, como as amostras da ficha acima.
 */

const CELULA = "px-3 py-2 align-middle";
const CABECA = "px-3 py-2 text-left font-display text-[10px] font-bold uppercase tracking-wider text-platform-text-muted";

export function ContrasteDaPaleta({ cores }: { cores: readonly CorMedida[] }) {
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const titulo = useId();
  const resultado = useMemo(() => contrastesDaPaleta(cores), [cores]);
  const { sobreReferencias, entreCores, semHex } = resultado;
  const confundem = useMemo(() => paresQueSeConfundem(cores), [cores]);

  if (sobreReferencias.length === 0 && semHex.length === 0) return null;

  const nome = (e: Extremo) =>
    e.tipo === "referencia" ? (e.qual === "branco" ? t("White", "Branco") : t("Black", "Preto")) : e.nome;
  const razao = (n: number) => (isEnglish ? n.toFixed(2) : n.toFixed(2).replace(".", ","));

  const veredito = (passa: boolean, grau?: string) => (
    <td className={CELULA} data-passa={passa ? "sim" : "nao"}>
      <span className={passa ? "font-bold text-platform-text" : "text-platform-text-muted"}>
        {passa ? `✓ ${t("Passes", "Passa")}` : `✕ ${t("Fails", "Falha")}`}
      </span>
      {passa && grau === "AAA" && <span className="ml-1 text-[10px] text-platform-text-muted">AAA</span>}
    </td>
  );

  const tabela = (pares: ParMedido[], rotulo: string) => {
    return (
      <div className="mt-3 overflow-x-auto border border-platform-border">
        <table className="w-full min-w-[640px] border-collapse text-sm" aria-label={rotulo}>
          <thead className="border-b border-platform-border">
            <tr>
              <th scope="col" className={CABECA}>{t("Pair", "Par")}</th>
              <th scope="col" className={CABECA}>{t("Ratio", "Razão")}</th>
              <th scope="col" className={CABECA}>{t(`Normal text (${LIMITE_TEXTO_COMUM.toString().replace(".", isEnglish ? "." : ",")}:1)`, `Texto comum (${LIMITE_TEXTO_COMUM.toString().replace(".", ",")}:1)`)}</th>
              <th scope="col" className={CABECA}>{t(`Large text (${LIMITE_TEXTO_GRANDE}:1)`, `Texto grande (${LIMITE_TEXTO_GRANDE}:1)`)}</th>
              <th scope="col" className={CABECA}>{t(`Icons and buttons (${LIMITE_ICONES_E_BOTOES}:1)`, `Ícones e botões (${LIMITE_ICONES_E_BOTOES}:1)`)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-platform-border">
            {pares.map((p) => (
              <tr key={`${p.a.hex}-${p.b.hex}-${nome(p.a)}-${nome(p.b)}`} data-par-de-contraste data-razao={p.razao.toFixed(2)} data-afirmado={p.afirmado ? "sim" : "nao"}>
                <th scope="row" className={`${CELULA} text-left font-normal`}>
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="inline-flex h-8 w-10 shrink-0 items-center justify-center border border-platform-border text-sm font-bold"
                      style={{ backgroundColor: p.b.hex, color: p.a.hex }}
                    >Aa</span>
                    <span className="min-w-0 text-platform-text">
                      {nome(p.a)} <span className="text-platform-text-muted">{t("on", "sobre")}</span> {nome(p.b)}
                      {!p.afirmado && (
                        <span data-par-em-rascunho className="ml-2 border border-dashed border-platform-border px-1.5 py-0.5 align-middle font-display text-[10px] font-bold uppercase tracking-wider text-platform-text-muted">
                          {t("draft color", "cor em rascunho")}
                        </span>
                      )}
                    </span>
                  </span>
                </th>
                <td className={`${CELULA} font-mono font-bold text-platform-text`}>{razao(p.razao)}:1</td>
                {veredito(p.veredito.textoPequeno !== "falha", p.veredito.textoPequeno)}
                {veredito(p.veredito.textoGrande !== "falha", p.veredito.textoGrande)}
                {veredito(p.veredito.iconesEBotoes === "passa")}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div data-contraste-da-paleta aria-labelledby={titulo} role="group" className="mt-12 border-t border-platform-border pt-8">
      <h3 id={titulo} className="font-display text-sm font-black uppercase tracking-[0.18em] text-platform-text">
        {t("Contrast between colors", "Contraste entre as cores")}
      </h3>
      <p data-definicao-da-razao className="mt-3 max-w-3xl text-sm leading-relaxed text-platform-text-muted">
        {t(
          "Contrast ratio is how many times brighter the lighter color is than the darker one, from 1:1 (identical) to 21:1 (black on white). The higher, the easier to read.",
          "Razão de contraste é quantas vezes a cor mais clara é mais luminosa que a mais escura, de 1:1 (iguais) a 21:1 (preto no branco). Quanto maior, mais fácil de ler.",
        )}
      </p>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-platform-text-muted">
        {t(
          "Normal text needs 4.5:1; large text (24 px, or 19 px in bold, and up) needs 3:1; icons and buttons need 3:1 (WCAG 2). It is measured from each color's HEX, with no AI involved.",
          "Texto comum pede 4,5:1; texto grande (a partir de 24 px, ou 19 px em negrito) pede 3:1; ícones e botões pedem 3:1 (WCAG 2). A medida sai do HEX de cada cor, sem IA.",
        )}
      </p>

      {sobreReferencias.length > 0 && (
        <>
          <p className="mt-6 text-xs font-bold uppercase tracking-wide text-platform-text-muted">{t("Each color on white and on black", "Cada cor sobre branco e sobre preto")}</p>
          {tabela(sobreReferencias, t("Each color on white and on black", "Cada cor sobre branco e sobre preto"))}
        </>
      )}

      {entreCores.length > 0 && (
        <details data-pares-entre-cores className="mt-6 border border-platform-border px-4 py-3">
          <summary className="cursor-pointer text-sm font-bold text-platform-text">
            {t(`Pairs between the palette colors (${entreCores.length})`, `Pares entre as cores da paleta (${entreCores.length})`)}
          </summary>
          <p className="mt-2 text-xs text-platform-text-muted">
            {t("Each pair appears once: the ratio is the same whichever color is the text.", "Cada par aparece uma vez: a razão é a mesma, qualquer que seja a cor do texto.")}
          </p>
          {tabela(entreCores, t("Pairs between the palette colors", "Pares entre as cores da paleta"))}
        </details>
      )}

      {[...sobreReferencias, ...entreCores].some((p) => !p.afirmado) && (
        <p data-aviso-de-rascunho className="mt-4 text-xs text-platform-text-muted">
          {t(
            "Pairs with a draft color are measured too, but marked: only approved colors are stated as the brand's.",
            "Pares com cor em rascunho também são medidos, mas ficam marcados: só cor aprovada é afirmada como da marca.",
          )}
        </p>
      )}

      {confundem.length > 0 && (
        <div data-cores-que-se-confundem className="mt-6 border border-platform-border px-4 py-3">
          <p className="text-sm font-bold text-platform-text">{t("Colors that get confused", "Cores que se confundem")}</p>
          <p className="mt-1 text-xs text-platform-text-muted">
            {t(
              "These pairs look clearly different to most people, but can look alike to someone with color blindness. Don't rely on color alone to tell them apart.",
              "Estes pares parecem bem diferentes para a maioria das pessoas, mas podem parecer iguais para quem tem daltonismo. Não dependa só da cor para distingui-las.",
            )}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-platform-text">
            {confundem.map((c) => (
              <li key={`${c.nomeA}-${c.nomeB}-${c.tipo}`} data-confusao={c.tipo}>
                <span aria-hidden className="mr-2 inline-block h-3 w-3 border border-platform-border align-middle" style={{ backgroundColor: c.a }} />
                <span aria-hidden className="mr-2 inline-block h-3 w-3 border border-platform-border align-middle" style={{ backgroundColor: c.b }} />
                {c.nomeA} / {c.nomeB} — {c.tipo}
                {!c.afirmado && <span className="ml-2 text-xs text-platform-text-muted">({t("draft color", "cor em rascunho")})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {semHex.length > 0 && (
        <p data-sem-hex className="mt-4 text-xs font-bold text-platform-text">
          {t(
            `Not measured (no HEX in the sheet): ${semHex.map((c) => c.nome).join(", ")}. Contrast is not calculated from CMYK or Pantone codes.`,
            `Não medidas (sem HEX na ficha): ${semHex.map((c) => c.nome).join(", ")}. O contraste não se calcula a partir de CMYK ou Pantone.`,
          )}
        </p>
      )}
    </div>
  );
}
