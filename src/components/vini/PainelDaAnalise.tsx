"use client";

import { useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { baixarPrancha } from "./baixarPrancha";
import { analiseEmMarkdown, tomDoVeredito } from "@/lib/ai/peca";
import type { AnalysisVerdict } from "@/lib/ai/analysis-result";
import { RespostaDoVini } from "./RespostaDoVini";
import type { useAnaliseDaPeca } from "./useAnaliseDaPeca";

/**
 * O estado "Análise" do Vini (spec do Assistente §2 e §4.2): a peça, o
 * progresso e o resultado, dentro da janela.
 *
 * ⚖️ O que reprova é a ÚNICA cor forte da tela; o que passa fica em tinta.
 * O corpo da análise passa pelo mesmo renderizador das respostas do Vini —
 * sem HTML, e com a citação levando o PDF à página.
 */
const SELO: Record<AnalysisVerdict, { pt: string; en: string; cor: string }> = {
  aligned: { pt: "Alinhada", en: "Aligned", cor: "border-platform-border text-platform-text" },
  partially_aligned: { pt: "Revisão necessária", en: "Review needed", cor: "border-platform-warning text-platform-warning" },
  misaligned: { pt: "Desalinhada", en: "Misaligned", cor: "border-platform-danger bg-platform-danger text-platform-bg" },
  unknown: { pt: "Sem veredito", en: "No verdict", cor: "border-platform-border text-platform-text-muted" },
};

const ETAPAS: { chave: "preparing" | "consulting" | "verifying"; pt: string; en: string }[] = [
  { chave: "preparing", pt: "Preparando a peça", en: "Preparing the piece" },
  { chave: "consulting", pt: "Consultando a IA visual", en: "Consulting visual AI" },
  { chave: "verifying", pt: "Conferindo com o manual", en: "Checking against the manual" },
];

export function PainelDaAnalise({
  analise, basePath,
}: { analise: ReturnType<typeof useAnaliseDaPeca>; basePath: string }) {
  const isEnglish = useIsEnglish();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);
  const { peca, etapa, mensagem, resultado, erro } = analise;
  const [baixando, setBaixando] = useState(false);
  const [falhaNoDownload, setFalhaNoDownload] = useState("");
  const atual = etapa === "fallback" ? "consulting" : etapa;
  const indice = ETAPAS.findIndex((e) => e.chave === atual);

  if (!peca) {
    return (
      <div data-analise-vazia className="flex h-full flex-col items-center justify-center gap-2 border border-dashed border-platform-border p-6 text-center">
        <p className="text-[14px] text-platform-text">{t("Solte a peça aqui", "Drop the piece here")}</p>
        <p className="text-[12px] text-platform-text-muted">
          {t("ou use o clipe no rodapé. JPG, PNG, WebP ou GIF, até 10 MB.", "or use the clip below. JPG, PNG, WebP or GIF, up to 10 MB.")}
        </p>
        {erro && <p role="alert" data-analise-erro className="mt-2 text-[13px] text-platform-text">{erro}</p>}
      </div>
    );
  }

  const tom = resultado ? tomDoVeredito(resultado.analise.verdict) : null;
  const corpo = resultado ? analiseEmMarkdown(resultado.analise, isEnglish) : "";

  return (
    <div data-analise className="space-y-4">
      <figure className="overflow-hidden rounded-md border border-platform-border bg-platform-bg">
        {/* A peça do cliente, como veio: sem recorte (object-contain). */}
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL local, não passa pelo otimizador */}
        <img src={peca.dataUrl} alt={t(`Peça: ${peca.nome}`, `Piece: ${peca.nome}`)} className="mx-auto max-h-[28dvh] w-auto object-contain" />
        <figcaption className="border-t border-platform-border px-3 py-1.5 text-[12px] text-platform-text-muted">{peca.nome}</figcaption>
      </figure>

      {etapa && (
        <div role="status" data-analise-progresso className="space-y-2 text-[13px]">
          <ol className="flex flex-wrap gap-x-4 gap-y-1">
            {ETAPAS.map((e, i) => (
              <li key={e.chave} className={i <= indice ? "text-platform-text" : "text-platform-text-muted"}>
                {i < indice ? "✓ " : i === indice ? "• " : ""}{isEnglish ? e.en : e.pt}
              </li>
            ))}
          </ol>
          <p className="text-platform-text-muted">{mensagem}</p>
        </div>
      )}

      {erro && <p role="alert" data-analise-erro className="border border-platform-border px-3 py-2 text-[13px] text-platform-text">{erro}</p>}

      {resultado && tom && (
        <div data-analise-resultado className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span data-veredito={tom}
              className={`border px-2 py-1 font-display text-[11px] font-bold uppercase tracking-wide ${SELO[tom].cor}`}>
              {isEnglish ? SELO[tom].en : SELO[tom].pt}
            </span>
            {resultado.demonstracao && (
              <span className="text-[11px] uppercase tracking-wide text-platform-text-muted">{t("Modo demonstração", "Demo mode")}</span>
            )}
          </div>
          {resultado.analise.verdict && (
            <p className="text-[14px] leading-relaxed text-platform-text">{resultado.analise.verdict}</p>
          )}
          {corpo
            ? <RespostaDoVini conteudo={corpo} paginas={resultado.paginas} basePath={basePath} />
            : <p className="text-[13px] text-platform-text-muted">{t("A análise não trouxe detalhes além do veredito.", "The review brought no details beyond the verdict.")}</p>}
          <div className="flex flex-wrap items-center gap-3 border-t border-platform-border pt-3">
            <button
              type="button"
              data-baixar-prancha
              disabled={baixando}
              onClick={async () => {
                setBaixando(true);
                setFalhaNoDownload("");
                try {
                  await baixarPrancha({
                    peca, analise: resultado.analise, paginas: resultado.paginas, tom,
                    rotuloDoSelo: isEnglish ? SELO[tom].en : SELO[tom].pt, ingles: isEnglish,
                  });
                } catch {
                  setFalhaNoDownload(t("Não foi possível montar a imagem. Tente de novo.", "Couldn't build the image. Try again."));
                } finally {
                  setBaixando(false);
                }
              }}
              className="h-10 border border-platform-border px-4 text-[12px] font-semibold text-platform-text hover:border-platform-signal disabled:opacity-50"
            >
              {baixando ? t("Montando…", "Building…") : t("Baixar imagem com as correções", "Download image with corrections")}
            </button>
            {falhaNoDownload && <p role="alert" className="text-[12px] text-platform-text">{falhaNoDownload}</p>}
          </div>
          <p className="text-[11px] text-platform-text-muted">
            {resultado.salvaNoHistorico
              ? t("Guardada no histórico desta marca.", "Saved to this brand's history.")
              : t("Não foi possível guardar no histórico — o resultado acima vale mesmo assim.", "Couldn't save to history — the result above still stands.")}
          </p>
        </div>
      )}
    </div>
  );
}
