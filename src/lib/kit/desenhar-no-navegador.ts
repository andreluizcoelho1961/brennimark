"use client";

import { zip, type Zippable } from "fflate";
import { pastaDoGrupo, ITENS_DO_KIT, type Grupo, type ItemDoKit } from "./tamanhos";
import {
  abaixoDaReducao, alturaDoItem, assinaturaHtml, avisosDoArquivo, encaixe, favicoIco, leiaMe, manifestDoSite, trechoDoHead, type DadosDaAssinatura, type ReducaoMinima, type RegrasInformadas,
} from "./pacote";

/**
 * O Brennimark Kit no NAVEGADOR (09/10/2026): carrega o logo de quem usa,
 * desenha cada tamanho num canvas e monta o .zip. Nada sobe para servidor
 * nenhum — custo zero por uso, e o arquivo não sai do computador da pessoa
 * (especificação v2, §5).
 *
 * O arquivo enviado é aberto como <img> (SVG em <img> não executa script) e
 * nunca entra no DOM como marcação.
 */

/** O desenho pronto para usar: já sem a sobra transparente em volta. */
export type Desenho = {
  fonte: HTMLCanvasElement;
  largura: number;
  altura: number;
  tipo: string;
  /** O SVG original, quando veio SVG — vai para o pacote como vetor. */
  svg: string | null;
  avisos: string[];
};

export type Fundo = { tipo: "branco" | "escuro" | "cor" | "transparente"; cor: string };

export type Escolhas = {
  logo: Desenho;
  simbolo: Desenho | null;
  negativo: Desenho | null;
  fundo: Fundo;
  margem: number;
  usarSimboloNosPequenos: boolean;
  /** Área de proteção informada pela pessoa, em fração da altura do desenho. */
  protecao: number;
  /** Redução mínima informada pela pessoa, largura em px. */
  reducao: ReducaoMinima;
  /** No Kit do assinante: de onde veio cada regra ("do manual, p. 12, aprovada"). */
  fontesDasRegras?: RegrasInformadas["fontes"];
};

const LADO_MAXIMO = 3000;
const ESCURO = "#111418";
const UMA_COR = "#111111";

export function corDoFundo(fundo: Fundo): string | null {
  if (fundo.tipo === "branco") return "#ffffff";
  if (fundo.tipo === "escuro") return ESCURO;
  if (fundo.tipo === "cor") return fundo.cor;
  return null;
}

/** Fundo escuro pede o logo claro: luminância relativa abaixo de 0,4. */
export function fundoEscuro(fundo: Fundo): boolean {
  const cor = corDoFundo(fundo);
  if (!cor || !/^#[0-9a-f]{6}$/i.test(cor)) return false;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.4;
}

function abrirImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rejeitar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => rejeitar(new Error("Não foi possível abrir este arquivo como imagem."));
    img.src = url;
  });
}

/**
 * SVG sem `width`/`height` abre com 0 × 0 (ou 300 × 150) num <img>. Damos a ele
 * um tamanho grande, na proporção do `viewBox`, para o canvas ter detalhe.
 */
function svgComTamanho(texto: string): string {
  const doc = new DOMParser().parseFromString(texto, "image/svg+xml");
  const raiz = doc.documentElement;
  if (raiz.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) {
    throw new Error("Este SVG não pôde ser lido.");
  }
  const vb = (raiz.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  let largura = parseFloat(raiz.getAttribute("width") ?? "");
  let altura = parseFloat(raiz.getAttribute("height") ?? "");
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    const p = vb[2] / vb[3];
    largura = p >= 1 ? LADO_MAXIMO : LADO_MAXIMO * p;
    altura = largura / p;
  } else if (!(largura > 0 && altura > 0)) {
    throw new Error("O SVG não diz o próprio tamanho (falta o viewBox).");
  } else {
    raiz.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
    const p = largura / altura;
    largura = p >= 1 ? LADO_MAXIMO : LADO_MAXIMO * p;
    altura = largura / p;
  }
  raiz.setAttribute("width", String(Math.round(largura)));
  raiz.setAttribute("height", String(Math.round(altura)));
  return new XMLSerializer().serializeToString(raiz);
}

/** Corta a sobra transparente em volta: a margem do Kit não pode somar à do arquivo. */
function semSobra(origem: CanvasImageSource, largura: number, altura: number): HTMLCanvasElement {
  const k = Math.min(1, LADO_MAXIMO / Math.max(largura, altura));
  const L = Math.max(1, Math.round(largura * k));
  const A = Math.max(1, Math.round(altura * k));
  const c = document.createElement("canvas");
  c.width = L;
  c.height = A;
  const x = c.getContext("2d")!;
  x.drawImage(origem, 0, 0, L, A);
  const { data } = x.getImageData(0, 0, L, A);
  let minX = L, minY = A, maxX = -1, maxY = -1;
  for (let y = 0; y < A; y++) {
    for (let i = 0; i < L; i++) {
      if (data[(y * L + i) * 4 + 3] > 8) {
        if (i < minX) minX = i;
        if (i > maxX) maxX = i;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("A imagem está toda transparente.");
  const cortado = document.createElement("canvas");
  cortado.width = maxX - minX + 1;
  cortado.height = maxY - minY + 1;
  cortado.getContext("2d")!.drawImage(c, minX, minY, cortado.width, cortado.height, 0, 0, cortado.width, cortado.height);
  return cortado;
}

export async function carregarDesenho(arquivo: File): Promise<Desenho> {
  const tipo = arquivo.type || (arquivo.name.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "");
  if (!["image/svg+xml", "image/png", "image/jpeg", "image/webp"].includes(tipo)) {
    throw new Error("Use um arquivo SVG, PNG ou JPG.");
  }
  let svg: string | null = null;
  let url: string;
  if (tipo === "image/svg+xml") {
    svg = await arquivo.text();
    url = URL.createObjectURL(new Blob([svgComTamanho(svg)], { type: "image/svg+xml" }));
  } else {
    url = URL.createObjectURL(arquivo);
  }
  try {
    const img = await abrirImagem(url);
    const fonte = semSobra(img, img.naturalWidth, img.naturalHeight);
    return {
      fonte, largura: fonte.width, altura: fonte.height, tipo, svg,
      avisos: avisosDoArquivo({ tipo, largura: img.naturalWidth, altura: img.naturalHeight }),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * O desenho em UMA cor — o negativo (branco) e a versão de uma cor (preta).
 *
 * Não é a silhueta chapada: as partes escuras do desenho viram a cor, e as
 * claras (o vazado, a letra amarela dentro do círculo) ficam transparentes,
 * deixando o fundo aparecer. É como um designer faz a versão de uma cor, e o
 * que impede o símbolo de virar um círculo liso. Se o desenho é todo claro
 * (um logo branco), essa regra apagaria quase tudo: aí vale a silhueta.
 */
const memoDeUmaCor = new WeakMap<Desenho, Map<string, HTMLCanvasElement>>();

export function umaCor(d: Desenho, cor: string): HTMLCanvasElement {
  const porCor = memoDeUmaCor.get(d) ?? new Map<string, HTMLCanvasElement>();
  memoDeUmaCor.set(d, porCor);
  const pronto = porCor.get(cor);
  if (pronto) return pronto;
  const feito = calcularUmaCor(d, cor);
  porCor.set(cor, feito);
  return feito;
}

function calcularUmaCor(d: Desenho, cor: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = d.largura;
  c.height = d.altura;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(d.fonte, 0, 0);
  const imagem = x.getImageData(0, 0, c.width, c.height);
  const px = imagem.data;
  const [r0, g0, b0] = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));
  const alfaOriginal = new Uint8ClampedArray(px.length / 4);
  let opacos = 0, mantidos = 0;
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const a = px[i + 3];
    alfaOriginal[j] = a;
    const luz = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    // escuro (luz < 0,45) fica inteiro; claro (> 0,75) some; entre os dois, gradua
    const peso = Math.min(1, Math.max(0, (0.75 - luz) / 0.3));
    const novo = Math.round(a * peso);
    if (a > 8) opacos++;
    if (novo > 8) mantidos++;
    px[i] = r0; px[i + 1] = g0; px[i + 2] = b0; px[i + 3] = novo;
  }
  if (opacos > 0 && mantidos / opacos < 0.25) {
    for (let i = 0, j = 0; i < px.length; i += 4, j++) px[i + 3] = alfaOriginal[j];
  }
  x.putImageData(imagem, 0, 0);
  return c;
}

function desenhoDoItem(item: ItemDoKit, e: Escolhas): Desenho {
  if (item.desenho === "simbolo") return e.simbolo ?? e.logo;
  if (item.desenho === "pequeno" && e.usarSimboloNosPequenos && e.simbolo) return e.simbolo;
  return e.logo;
}

/**
 * Onde o desenho cai neste item, e se ficou abaixo da redução mínima — a
 * mesma conta do desenho, para o aviso da tela dizer a verdade sobre o arquivo.
 */
export function medirItem(item: ItemDoKit, e: Escolhas): { largura: number; abaixoDe: number | null } {
  const d = desenhoDoItem(item, e);
  const r = encaixe(item, d, e.margem, e.protecao);
  const qual = d === e.simbolo ? "simbolo" : "logo";
  return { largura: r.largura, abaixoDe: abaixoDaReducao(item, r.largura, qual, e.reducao) };
}

/** Desenha um item. `escala` < 1 serve à prévia; o pacote usa 1. */
export function desenharItem(item: ItemDoKit, e: Escolhas, escala = 1): HTMLCanvasElement {
  const d = desenhoDoItem(item, e);
  const L = item.largura;
  const A = alturaDoItem(item, d);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(L * escala));
  c.height = Math.max(1, Math.round(A * escala));
  const x = c.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  x.scale(escala, escala);

  const transparente = item.formato === "transparente";
  const fundo = transparente ? null : corDoFundo(e.fundo);
  if (fundo) {
    x.fillStyle = fundo;
    x.fillRect(0, 0, L, A);
  }

  // Qual tinta: o tom pedido pelo item, ou o claro sobre fundo escuro.
  let fonte: CanvasImageSource = d.fonte;
  const tom = item.tom ?? (fundo && fundoEscuro(e.fundo) ? "negativo" : "original");
  if (tom === "negativo") fonte = e.negativo && d === e.logo ? e.negativo.fonte : umaCor(d, "#ffffff");
  if (tom === "uma-cor") fonte = umaCor(d, UMA_COR);

  const r = encaixe(item, d, e.margem, e.protecao);
  x.drawImage(fonte, r.x, r.y, r.largura, r.altura);
  return c;
}

function pngDe(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolver, rejeitar) =>
    canvas.toBlob(async (blob) => (blob ? resolver(new Uint8Array(await blob.arrayBuffer())) : rejeitar(new Error("png"))), "image/png"),
  );
}

const texto = (s: string) => new TextEncoder().encode(s);

/** Os itens que entram, conforme o que foi enviado (sem símbolo, sem arquivo de símbolo). */
export function itensDoPacote(grupos: readonly Grupo[], e: Pick<Escolhas, "simbolo">): ItemDoKit[] {
  return ITENS_DO_KIT.filter((i) => grupos.includes(i.grupo) && !(i.desenho === "simbolo" && !e.simbolo));
}

/** Quantos arquivos o pacote terá — o mesmo critério de `montarPacote`. */
export function contarArquivos(grupos: readonly Grupo[], e: Escolhas): number {
  const svgPequeno = (e.usarSimboloNosPequenos && e.simbolo ? e.simbolo : e.logo).svg;
  let extras = 1; // LEIA-ME
  if (grupos.includes("site")) extras += 3 + (svgPequeno ? 1 : 0); // .ico, manifest, trecho, svg
  if (grupos.includes("email")) extras += 1;
  if (grupos.includes("apresentacao")) extras += (e.logo.svg ? 1 : 0) + (e.simbolo?.svg ? 1 : 0);
  return itensDoPacote(grupos, e).length + extras;
}

export async function montarPacote(
  grupos: readonly Grupo[],
  e: Escolhas,
  nome: string,
  assinatura: DadosDaAssinatura & { enderecoDoLogo: string },
  aoAvancar?: (prontos: number, total: number) => void,
): Promise<Blob> {
  const conteudo: Zippable = {};
  const itens = itensDoPacote(grupos, e);
  const icos: { tamanho: number; bytes: Uint8Array }[] = [];
  let prontos = 0;
  for (const item of itens) {
    const bytes = await pngDe(desenharItem(item, e));
    conteudo[`${pastaDoGrupo(item.grupo)}/${item.arquivo}`] = [bytes, { level: 0 }];
    if (item.ico) icos.push({ tamanho: item.largura, bytes });
    aoAvancar?.(++prontos, itens.length);
    // Devolve a vez ao navegador: a tela não congela num pacote de 40 imagens.
    await new Promise((r) => setTimeout(r, 0));
  }

  if (grupos.includes("site")) {
    conteudo["site/favicon.ico"] = [favicoIco(icos), { level: 0 }];
    const svgPequeno = (e.usarSimboloNosPequenos && e.simbolo ? e.simbolo : e.logo).svg;
    if (svgPequeno) conteudo["site/favicon.svg"] = [texto(svgPequeno), { level: 6 }];
    conteudo["site/site.webmanifest"] = [texto(manifestDoSite(nome || "Site", corDoFundo(e.fundo) ?? "#ffffff")), { level: 6 }];
    conteudo["site/COLE-NO-SITE.html"] = [texto(trechoDoHead(Boolean(svgPequeno))), { level: 6 }];
  }
  if (grupos.includes("email")) {
    const endereco = assinatura.enderecoDoLogo.trim() || "assinatura-logo-600.png";
    conteudo["email/assinatura.html"] = [texto(
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Assinatura de e-mail</title>\n`
      + `<!-- Abra este arquivo no navegador, selecione a assinatura, copie e cole nas configurações do seu e-mail. -->\n`
      + assinaturaHtml(assinatura, endereco) + "\n",
    ), { level: 6 }];
  }
  if (grupos.includes("apresentacao")) {
    if (e.logo.svg) conteudo["apresentacao/logotipo.svg"] = [texto(e.logo.svg), { level: 6 }];
    if (e.simbolo?.svg) conteudo["apresentacao/simbolo.svg"] = [texto(e.simbolo.svg), { level: 6 }];
  }
  const abaixo = itens.map((i) => ({ i, m: medirItem(i, e) })).filter((x) => x.m.abaixoDe).map((x) => `${pastaDoGrupo(x.i.grupo)}/${x.i.arquivo} (${Math.round(x.m.largura)} px; mínimo ${x.m.abaixoDe} px)`);
  conteudo["LEIA-ME.txt"] = [texto(leiaMe(nome, Boolean(e.usarSimboloNosPequenos && e.simbolo), grupos.includes("email"), { protecao: e.protecao, reducao: e.reducao, abaixo, fontes: e.fontesDasRegras })), { level: 6 }];

  const bytes = await new Promise<Uint8Array>((resolver, rejeitar) => zip(conteudo, (erro, dados) => (erro ? rejeitar(erro) : resolver(dados))));
  return new Blob([bytes as BlobPart], { type: "application/zip" });
}
