"use client";

import { useEffect, useRef, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import {
  LIMITE_DO_USO, amostrarMediana, medirPar, passaNoUso, simularPixels, sugerirAjuste,
  type CorAprovada, type UsoDoPar,
} from "@/lib/cores/acessibilidade-da-peca";
import type { Daltonismo } from "@/lib/cores/cores";

/**
 * Acessibilidade DENTRO da peça — fatias 2, 3 e 4 (06/11/2026).
 *
 * Contraste: a pessoa clica na cor do texto e na do fundo, NA PEÇA, e a
 * plataforma mede. Daltonismo: a peça inteira como a vê quem tem protanopia,
 * deuteranopia ou tritanopia. Ajuste: cores da paleta APROVADA que resolvem.
 *
 * Tudo no navegador, sobre os pixels da peça já aberta: nada vai a servidor, e
 * nenhuma IA mede (a IA de visão não afirma HEX lido de imagem). Moldura da
 * plataforma, acromática: passa/falha se dizem pela palavra e por ✓/✕. As
 * únicas cores "de fora" são as amostras, que são conteúdo.
 */

const TIPOS: { id: "normal" | Daltonismo; pt: string; en: string; dicaPt: string; dicaEn: string }[] = [
  { id: "normal", pt: "Como está", en: "As is", dicaPt: "A peça como foi enviada.", dicaEn: "The piece as sent." },
  { id: "protanopia", pt: "Protanopia", en: "Protanopia", dicaPt: "Vermelho some ou escurece; confunde vermelho com verde.", dicaEn: "Red fades or darkens; confuses red with green." },
  { id: "deuteranopia", pt: "Deuteranopia", en: "Deuteranopia", dicaPt: "O tipo mais comum: confunde verde com vermelho e marrom.", dicaEn: "The most common type: confuses green with red and brown." },
  { id: "tritanopia", pt: "Tritanopia", en: "Tritanopia", dicaPt: "Raro: confunde azul com verde e amarelo com rosa.", dicaEn: "Rare: confuses blue with green and yellow with pink." },
];

const USOS: { id: UsoDoPar; pt: string; en: string }[] = [
  { id: "texto-comum", pt: "Texto comum", en: "Normal text" },
  { id: "texto-grande", pt: "Texto grande", en: "Large text" },
  { id: "icones-e-botoes", pt: "Ícones e botões", en: "Icons and buttons" },
];

const LARGURA_MAXIMA = 1400;

export function AcessibilidadeDaPeca({ dataUrl }: { dataUrl: string }) {
  const isEnglish = useIsEnglish();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);
  const num = (n: number) => (isEnglish ? n.toFixed(2) : n.toFixed(2).replace(".", ","));
  const alvo = useAlvo();
  const canvas = useRef<HTMLCanvasElement>(null);
  const original = useRef<ImageData | null>(null);
  const [modo, setModo] = useState<"normal" | Daltonismo>("normal");
  const [texto, setTexto] = useState<string | null>(null);
  const [fundo, setFundo] = useState<string | null>(null);
  const [uso, setUso] = useState<UsoDoPar>("texto-comum");
  const [paleta, setPaleta] = useState<CorAprovada[] | "indisponivel" | null>(null);
  const [falhou, setFalhou] = useState(false);

  // Desenha a peça (cabendo na largura) e guarda os pixels originais.
  useEffect(() => {
    let cancelado = false;
    const img = new Image();
    img.onload = () => {
      const c = canvas.current;
      if (cancelado || !c) return;
      const escala = Math.min(1, LARGURA_MAXIMA / img.naturalWidth);
      c.width = Math.max(1, Math.round(img.naturalWidth * escala));
      c.height = Math.max(1, Math.round(img.naturalHeight * escala));
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      original.current = ctx.getImageData(0, 0, c.width, c.height);
      setModo("normal");
    };
    img.onerror = () => { if (!cancelado) setFalhou(true); };
    img.src = dataUrl;
    return () => { cancelado = true; };
  }, [dataUrl]);

  // A simulação sempre parte dos pixels ORIGINAIS: trocar de tipo não acumula conta.
  useEffect(() => {
    const c = canvas.current, o = original.current;
    if (!c || !o) return;
    const copia = new ImageData(new Uint8ClampedArray(o.data), o.width, o.height);
    if (modo !== "normal") simularPixels(copia.data, modo);
    c.getContext("2d")!.putImageData(copia, 0, 0);
  }, [modo, dataUrl, falhou]);

  // A paleta aprovada da marca, para o ajuste. Falhar não derruba a medida.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await fetch(comAlvo("/api/cores/paleta", alvo), { cache: "no-store" }).catch(() => null);
      const corpo = r?.ok ? await r.json().catch(() => null) : null;
      if (cancelado) return;
      setPaleta(corpo?.paleta ? (corpo.paleta as CorAprovada[]) : "indisponivel");
    })();
    return () => { cancelado = true; };
  }, [alvo]);

  function pegar(evento: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvas.current, o = original.current;
    if (!c || !o) return;
    const caixa = c.getBoundingClientRect();
    const x = Math.min(o.width - 1, Math.max(0, Math.floor(((evento.clientX - caixa.left) / caixa.width) * o.width)));
    const y = Math.min(o.height - 1, Math.max(0, Math.floor(((evento.clientY - caixa.top) / caixa.height) * o.height)));
    // Sempre dos pixels originais, mesmo com a simulação na tela.
    const hex = amostrarMediana(o.data, o.width, o.height, x, y);
    if (texto === null) setTexto(hex);
    else if (fundo === null) setFundo(hex);
    else { setTexto(hex); setFundo(null); }
  }

  const medida = texto && fundo ? medirPar(texto, fundo) : null;
  const ajuste = texto && fundo && paleta && paleta !== "indisponivel" ? sugerirAjuste(texto, fundo, uso, paleta) : null;
  const proximo = texto === null ? t("Clique na cor do TEXTO", "Click the TEXT color") : fundo === null ? t("Agora clique na cor do FUNDO", "Now click the BACKGROUND color") : t("Clique de novo para medir outro par", "Click again to measure another pair");

  const amostra = (rotulo: string, hex: string | null, dado: string) => (
    <div data-amostra={dado} className="flex items-center gap-2">
      <span aria-hidden className="h-6 w-6 shrink-0 border border-platform-border" style={hex ? { backgroundColor: hex } : undefined} />
      <span className="text-[12px] text-platform-text-muted">{rotulo}</span>
      <span className="font-mono text-[12px] text-platform-text">{hex ?? "—"}</span>
    </div>
  );

  return (
    <details open data-acessibilidade-da-peca className="border border-platform-border px-3 py-3">
      <summary className="cursor-pointer font-display text-[11px] font-black uppercase tracking-[0.18em] text-platform-text">
        {t("Acessibilidade da peça", "Piece accessibility")}
      </summary>
      <p className="mt-2 text-[12px] leading-relaxed text-platform-text-muted">
        {t(
          "Medido aqui, no seu navegador, sem IA e sem enviar nada. Razão de contraste é quantas vezes a cor mais clara é mais luminosa que a mais escura, de 1:1 a 21:1. Em imagem comprimida (JPEG) a cor pode variar um pouco de um ponto para outro.",
          "Measured here, in your browser, with no AI and nothing sent. Contrast ratio is how many times brighter the lighter color is than the darker one, from 1:1 to 21:1. In compressed images (JPEG) color can vary slightly between points.",
        )}
      </p>

      <div role="group" aria-label={t("Como a peça é vista", "How the piece is seen")} className="mt-3 flex flex-wrap gap-2">
        {TIPOS.map((tipo) => (
          <button key={tipo.id} type="button" data-daltonismo={tipo.id} aria-pressed={modo === tipo.id} title={isEnglish ? tipo.dicaEn : tipo.dicaPt}
            onClick={() => setModo(tipo.id)}
            className={`h-8 border px-3 text-[11px] font-semibold ${modo === tipo.id ? "border-platform-text bg-platform-text text-platform-bg" : "border-platform-border text-platform-text hover:border-platform-signal"}`}>
            {isEnglish ? tipo.en : tipo.pt}
          </button>
        ))}
      </div>
      <p data-dica-do-daltonismo className="mt-1 text-[11px] text-platform-text-muted">
        {(() => { const a = TIPOS.find((x) => x.id === modo)!; return isEnglish ? a.dicaEn : a.dicaPt; })()}
        {modo !== "normal" && t(" É uma simulação aproximada, não um laudo nem uma sugestão de cor.", " This is an approximate simulation, not a diagnosis or a color suggestion.")}
      </p>

      {falhou
        ? <p role="alert" className="mt-3 text-[12px] text-platform-text">{t("Não foi possível abrir a peça para medir.", "Couldn't open the piece to measure.")}</p>
        : <canvas ref={canvas} data-acessibilidade-canvas data-modo={modo} onClick={pegar} aria-label={t("Peça para medir: clique na cor do texto e depois na do fundo", "Piece to measure: click the text color, then the background color")}
            className="mx-auto mt-3 block max-h-[34dvh] max-w-full cursor-crosshair border border-platform-border" />}

      <p data-proximo-clique className="mt-3 text-[12px] font-bold text-platform-text">{proximo}</p>
      <div className="mt-2 grid gap-1">
        {amostra(t("Texto", "Text"), texto, "texto")}
        {amostra(t("Fundo", "Background"), fundo, "fundo")}
      </div>
      {(texto || fundo) && (
        <button type="button" data-limpar-amostras onClick={() => { setTexto(null); setFundo(null); }} className="mt-2 text-[11px] underline text-platform-text-muted hover:text-platform-text">
          {t("Limpar", "Clear")}
        </button>
      )}

      {medida && texto && fundo && (
        <div data-medida className="mt-3 space-y-2 border-t border-platform-border pt-3">
          <p className="text-[14px] text-platform-text">
            {t("Razão de contraste", "Contrast ratio")}: <b data-razao={medida.razao.toFixed(2)} className="font-mono">{num(medida.razao)}:1</b>
          </p>
          <ul className="space-y-1 text-[12px]">
            {USOS.map((u) => {
              const passa = passaNoUso(medida.razao, u.id);
              return (
                <li key={u.id} data-uso={u.id} data-passa={passa ? "sim" : "nao"} className={passa ? "font-bold text-platform-text" : "text-platform-text-muted"}>
                  {passa ? "✓" : "✕"} {isEnglish ? u.en : u.pt} ({num(LIMITE_DO_USO[u.id]).replace(/[,.]00$/, "")}:1) — {passa ? t("passa", "passes") : t("falha", "fails")}
                </li>
              );
            })}
          </ul>
          <p data-sob-daltonismo className="text-[11px] text-platform-text-muted">
            {t("Para quem tem", "For people with")}{" "}
            {(["protanopia", "deuteranopia", "tritanopia"] as const).map((d, i) => (
              <span key={d}>{i > 0 && " · "}{d === "protanopia" ? t("protanopia", "protanopia") : d === "deuteranopia" ? t("deuteranopia", "deuteranopia") : t("tritanopia", "tritanopia")}: <b className="font-mono">{num(medida.sobDaltonismo[d])}:1</b></span>
            ))}
          </p>

          <div className="pt-1">
            <label className="text-[11px] font-bold uppercase tracking-wide text-platform-text-muted">
              {t("Ajuste para", "Fix for")}{" "}
              <select data-uso-do-ajuste value={uso} onChange={(e) => setUso(e.target.value as UsoDoPar)} className="ml-1 border border-platform-border bg-platform-bg px-2 py-1 text-[12px] normal-case text-platform-text">
                {USOS.map((u) => <option key={u.id} value={u.id}>{isEnglish ? u.en : u.pt}</option>)}
              </select>
            </label>
            <div data-ajuste={ajuste?.estado ?? (paleta === "indisponivel" ? "sem-paleta" : "carregando")} className="mt-2 text-[12px] text-platform-text">
              {ajuste?.estado === "ja-passa" && <p>{t("Já passa para este uso — nada a ajustar.", "Already passes for this use — nothing to fix.")}</p>}
              {(paleta === "indisponivel" || ajuste?.estado === "sem-paleta") && <p className="text-platform-text-muted">{t("Não há cor aprovada na paleta desta marca para sugerir. O Vini não sugere cor de fora da paleta.", "There are no approved colors in this brand's palette to suggest. Vini doesn't suggest colors from outside the palette.")}</p>}
              {ajuste?.estado === "nenhuma" && <p>{t("Nenhuma cor aprovada da paleta resolve este par. Não sugiro uma cor fora da paleta: peça ao time de marca uma variação aprovada.", "No approved palette color fixes this pair. I won't suggest a color outside the palette: ask the brand team for an approved variation.")}</p>}
              {ajuste?.estado === "sugestoes" && (
                <ul className="space-y-1">
                  {ajuste.sugestoes.map((s) => (
                    <li key={`${s.alvo}-${s.hex}`} data-sugestao={s.alvo} className="flex items-center gap-2">
                      <span aria-hidden className="h-4 w-4 shrink-0 border border-platform-border" style={{ backgroundColor: s.hex }} />
                      <span>
                        {s.alvo === "texto" ? t("Trocar o texto por", "Change the text to") : t("Trocar o fundo por", "Change the background to")}{" "}
                        <b>{s.nome}</b> <span className="font-mono text-platform-text-muted">{s.hex}</span> → <span className="font-mono">{num(s.razao)}:1</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </details>
  );
}
