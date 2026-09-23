"use client";

import type { AnalysisVerdict, StructuredAnalysis } from "@/lib/ai/analysis-result";
import type { MapaDePaginas } from "@/lib/ai/paginas-citadas";
import { itensDaPrancha, linhaDaFonte, nomeDaPrancha, quebrarTexto } from "@/lib/ai/prancha-da-analise";

/**
 * Desenha a prancha da análise e a entrega para baixar, como PNG — no
 * navegador, sem servidor: a peça não sai de novo da máquina de quem analisa.
 *
 * ⚖️ A peça entra INTACTA, na proporção original, sem nada por cima. O
 * conteúdo da prancha (o que vai, com qual procedência) é decidido em
 * `lib/ai/prancha-da-analise.ts`; aqui só se desenha.
 *
 * Cores de impressão, neutras, e a fonte da INTERFACE: a prancha é
 * instrumento do produto sobre a marca, não peça da marca — a fonte da marca
 * só aparece onde demonstra a marca (CLAUDE.md, Tipografia).
 */
const TINTA = "#141414";
const APAGADA = "#5f5f5f";
const PAPEL = "#ffffff";
const FIO = "#d9d9d9";
const COR_DO_SELO: Record<AnalysisVerdict, string> = {
  misaligned: "#c62828",
  partially_aligned: "#a15c00",
  aligned: TINTA,
  unknown: APAGADA,
};

const MARGEM = 56;
const LADO_MAXIMO_DA_PECA = 1600;

function fonteDaInterface(): string {
  const raiz = getComputedStyle(document.documentElement);
  return raiz.getPropertyValue("--font-ui").trim() || "system-ui, -apple-system, 'Segoe UI', sans-serif";
}

function carregarImagem(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("imagem"));
    img.src = dataUrl;
  });
}

export async function baixarPrancha(entrada: {
  peca: { nome: string; dataUrl: string };
  analise: StructuredAnalysis;
  paginas: MapaDePaginas;
  tom: AnalysisVerdict;
  rotuloDoSelo: string;
  ingles: boolean;
  agora?: Date;
}) {
  const { peca, analise, paginas, tom, rotuloDoSelo, ingles } = entrada;
  const img = await carregarImagem(peca.dataUrl);

  // A peça no tamanho dela, reduzida só se passar do teto — nunca ampliada.
  const escala = Math.min(1, LADO_MAXIMO_DA_PECA / Math.max(img.naturalWidth, img.naturalHeight));
  const larguraDaPeca = Math.max(1, Math.round(img.naturalWidth * escala));
  const alturaDaPeca = Math.max(1, Math.round(img.naturalHeight * escala));
  const larguraDoPainel = Math.max(560, Math.round(larguraDaPeca * 0.55));

  const familia = fonteDaInterface();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  const itens = itensDaPrancha(analise, paginas);
  const data = (entrada.agora ?? new Date()).toLocaleDateString(ingles ? "en-GB" : "pt-BR");
  const rodape = ingles
    ? `Automatic review · Brennimark · ${data}. Check each item against the manual.`
    : `Análise automática · Brennimark · ${data}. Confira cada item no manual.`;

  /** Uma passada que mede e, se `desenhar`, pinta. Devolve a altura usada. */
  const compor = (desenhar: boolean): number => {
    const x = MARGEM + larguraDaPeca + MARGEM;
    const largura = larguraDoPainel;
    let y = MARGEM;

    // O carimbo do veredito.
    ctx.font = `700 34px ${familia}`;
    const larguraDoSelo = ctx.measureText(rotuloDoSelo.toUpperCase()).width + 44;
    if (desenhar) {
      ctx.save();
      ctx.translate(x + larguraDoSelo / 2, y + 36);
      ctx.rotate(-0.035);
      ctx.strokeStyle = COR_DO_SELO[tom];
      ctx.lineWidth = 5;
      ctx.strokeRect(-larguraDoSelo / 2, -32, larguraDoSelo, 64);
      ctx.fillStyle = COR_DO_SELO[tom];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(rotuloDoSelo.toUpperCase(), 0, 2);
      ctx.restore();
    }
    y += 104;

    // O veredito por extenso.
    if (analise.verdict.trim()) {
      ctx.font = `400 24px ${familia}`;
      for (const linha of quebrarTexto(analise.verdict.trim(), largura, (s) => ctx.measureText(s).width)) {
        if (desenhar) { ctx.fillStyle = TINTA; ctx.fillText(linha, x, y); }
        y += 34;
      }
      y += 18;
    }

    // As correções, numeradas, cada uma com a procedência.
    const recuo = 48;
    for (const item of itens) {
      if (desenhar) {
        ctx.fillStyle = FIO;
        ctx.fillRect(x, y - 26, largura, 1);
        ctx.font = `700 26px ${familia}`;
        ctx.fillStyle = COR_DO_SELO[tom] === TINTA ? TINTA : COR_DO_SELO[tom];
        ctx.fillText(`${item.numero}.`, x, y + 8);
      }
      y += 8;
      ctx.font = `500 23px ${familia}`;
      for (const linha of quebrarTexto(item.texto, largura - recuo, (s) => ctx.measureText(s).width)) {
        if (desenhar) { ctx.fillStyle = TINTA; ctx.fillText(linha, x + recuo, y); }
        y += 32;
      }
      ctx.font = `400 18px ${familia}`;
      for (const fonte of item.fontes) {
        for (const linha of quebrarTexto(linhaDaFonte(fonte, ingles), largura - recuo, (s) => ctx.measureText(s).width)) {
          if (desenhar) { ctx.fillStyle = APAGADA; ctx.fillText(linha, x + recuo, y); }
          y += 26;
        }
      }
      y += 30;
    }
    if (itens.length === 0) {
      ctx.font = `400 20px ${familia}`;
      const vazio = ingles ? "The review listed no corrections." : "A análise não listou correções.";
      if (desenhar) { ctx.fillStyle = APAGADA; ctx.fillText(vazio, x, y); }
      y += 40;
    }

    // Rodapé: de onde veio, e que é automática.
    y += 12;
    ctx.font = `400 17px ${familia}`;
    for (const linha of quebrarTexto(rodape, largura, (s) => ctx.measureText(s).width)) {
      if (desenhar) { ctx.fillStyle = APAGADA; ctx.fillText(linha, x, y); }
      y += 24;
    }
    return y + MARGEM;
  };

  // Primeiro mede, com um canvas qualquer; depois dimensiona e desenha.
  canvas.width = MARGEM * 3 + larguraDaPeca + larguraDoPainel;
  canvas.height = 10;
  const alturaDoPainel = compor(false);
  canvas.width = MARGEM * 3 + larguraDaPeca + larguraDoPainel;
  canvas.height = Math.max(alturaDaPeca + MARGEM * 2, alturaDoPainel);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = PAPEL;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, MARGEM, MARGEM, larguraDaPeca, alturaDaPeca);
  ctx.strokeStyle = FIO;
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGEM - 0.5, MARGEM - 0.5, larguraDaPeca + 1, alturaDaPeca + 1);
  compor(true);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("png");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeDaPrancha(peca.nome, ingles);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // O navegador já copiou o arquivo; o endereço temporário pode sair.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
