/**
 * O Brennimark Cores (10/10/2026) — a matemática, pura e testada.
 *
 * Especificação v2.2 (aprovada em 08/10): pegar uma cor de qualquer lugar,
 * saber os códigos, um nome em português, se dá para ler texto sobre ela, como
 * aparece para quem não enxerga certas cores e — no assinante — se ela é a cor
 * da marca. Tudo no navegador de quem usa; nada vai a servidor.
 *
 * Decisões que este arquivo carrega:
 *   - HEX, RGB e HSB são a mesma cor escrita de jeitos diferentes: exatos;
 *   - CMYK é SEMPRE aproximado (fórmula simples, couché ou offset): depende do
 *     papel e da gráfica, e quem vale para impressão é o manual ou a prova;
 *   - Pantone: nenhum. A tabela é da Pantone; só aparece o que o manual declara;
 *   - o nome sai de REGRAS sobre tom, claridade e intensidade — sem tabela de
 *     terceiros nem licença;
 *   - "é a cor da marca?" mede a diferença como o OLHO percebe (ΔE 2000), não
 *     pela distância entre códigos; só cor APROVADA vale como cor da marca.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type Rgb = [number, number, number];

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function hexParaRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbParaHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(limitar(v, 0, 255)).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** HSB (o do seletor do Photoshop): matiz 0–360, saturação e brilho 0–100. */
export function rgbParaHsb(r: number, g: number, b: number): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [Math.round(h) % 360, Math.round(max ? (d / max) * 100 : 0), Math.round(max * 100)];
}

export function hsbParaRgb(h: number, s: number, v: number): Rgb {
  const S = s / 100, V = v / 100;
  const f = (n: number) => { const k = (n + h / 60) % 6; return V - V * S * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}

export type Papel = "couche" | "offset";

/**
 * CMYK APROXIMADO. Fórmula simples; no papel não revestido (offset), a tinta
 * espalha mais, então o Kit pede um pouco menos de cor e um pouco mais de
 * preto. Nunca é o CMYK de verdade — a tela diz isso ao lado.
 */
export function rgbParaCmyk(r: number, g: number, b: number, papel: Papel = "couche"): [number, number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const k = 1 - Math.max(R, G, B);
  if (k >= 1) return [0, 0, 0, 100];
  let c = (1 - R - k) / (1 - k), m = (1 - G - k) / (1 - k), y = (1 - B - k) / (1 - k), kk = k;
  if (papel === "offset") { c *= 0.9; m *= 0.9; y *= 0.9; kk = Math.min(1, k * 1.05); }
  return [c, m, y, kk].map((v) => Math.round(v * 100)) as [number, number, number, number];
}

export function cmykParaRgb(c: number, m: number, y: number, k: number): Rgb {
  return [255 * (1 - c / 100) * (1 - k / 100), 255 * (1 - m / 100) * (1 - k / 100), 255 * (1 - y / 100) * (1 - k / 100)];
}

/** O que a pessoa digita ou cola: HEX, `rgb(…)`, `hsb(…)`, `cmyk(…)` ou "r g b". */
export function lerCodigo(texto: string): string | null {
  const t = texto.trim().toLowerCase();
  const hex = t.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return "#" + h.toUpperCase();
  }
  const n = (t.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const faixa = (v: number[], max: number[]) => v.every((x, i) => x >= 0 && x <= max[i]);
  if (/^(hsb|hsv)/.test(t) && n.length >= 3 && faixa(n.slice(0, 3), [360, 100, 100])) return rgbParaHex(...hsbParaRgb(n[0], n[1], n[2]));
  if (t.startsWith("cmyk") && n.length >= 4 && faixa(n.slice(0, 4), [100, 100, 100, 100])) return rgbParaHex(...cmykParaRgb(n[0], n[1], n[2], n[3]));
  if ((t.startsWith("rgb") || (n.length === 3 && !t.includes("%"))) && n.length >= 3 && faixa(n.slice(0, 3), [255, 255, 255])) return rgbParaHex(n[0], n[1], n[2]);
  return null;
}

// ─── Percepção ─────────────────────────────────────────────────────────────

function linear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function rgbParaLab(r: number, g: number, b: number): [number, number, number] {
  const R = linear(r), G = linear(g), B = linear(b);
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  X = f(X); Y = f(Y); Z = f(Z);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/** ΔE 2000: a diferença entre duas cores como o olho humano a percebe. */
export function deltaE2000(hexA: string, hexB: string): number {
  const [L1, a1, b1] = rgbParaLab(...hexParaRgb(hexA));
  const [L2, a2, b2] = rgbParaLab(...hexParaRgb(hexB));
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (a: number, b: number) => { if (!a && !b) return 0; const x = Math.atan2(b, a) / rad; return x < 0 ? x + 360 : x; };
  const h1p = h(a1p, b1), h2p = h(a2p, b2);
  const dL = L2 - L1, dC = C2p - C1p;
  let dh = h2p - h1p;
  if (C1p * C2p === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lm = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hm = h1p + h2p;
  if (C1p * C2p !== 0) { hm = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2; if (hm >= 360) hm -= 360; }
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), Sc = 1 + 0.045 * Cmp, Sh = 1 + 0.015 * Cmp * T;
  const Rt = -2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

// ─── O nome em português (regras, sem tabela de terceiros) ─────────────────

const FAIXAS_DE_MATIZ: [number, string][] = [
  [10, "vermelho"], [20, "laranja avermelhado"], [38, "laranja"], [48, "âmbar"], [62, "amarelo"], [80, "verde-limão"],
  [150, "verde"], [172, "verde-água"], [195, "azul petróleo"], [215, "azul"], [245, "azul royal"], [265, "anil"],
  [290, "roxo"], [320, "magenta"], [345, "rosa"], [361, "vermelho"],
];

export function nomeDaCor(hex: string): string {
  const [r, g, b] = hexParaRgb(hex);
  const [h, s, v] = rgbParaHsb(r, g, b);
  const L = rgbParaLab(r, g, b)[0];
  if (s < 10 || (s < 18 && v < 30)) {
    if (L > 96) return "branco";
    if (L < 8) return "preto";
    const temperatura = b > r + 6 ? " frio" : r > b + 6 ? " quente" : "";
    return "cinza" + temperatura + (L > 75 ? " claro" : L < 35 ? " escuro" : "");
  }
  let base = FAIXAS_DE_MATIZ.find(([limite]) => h < limite)![1];
  if (base.startsWith("laranja") && v < 55) base = "marrom" + (s > 60 ? " avermelhado" : "");
  if (base === "âmbar" && v < 55) base = "marrom dourado";
  if (base === "amarelo" && v < 60) base = "oliva";
  const claridade = L > 80 ? " claro" : L < 22 ? " muito escuro" : L < 38 ? " escuro" : "";
  const forca = s > 85 && v > 80 ? " vivo" : s < 35 ? " acinzentado" : "";
  return base + claridade + forca;
}

// ─── Leitura: contraste e daltonismo ───────────────────────────────────────

export function luminancia(hex: string): number {
  const [r, g, b] = hexParaRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** A razão de contraste da regra internacional de acessibilidade (WCAG 2). */
export function contraste(a: string, b: string): number {
  const x = luminancia(a), y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export type Veredito = { textoPequeno: "AAA" | "AA" | "não passa"; textoGrande: "AAA" | "AA" | "não passa"; iconesEBotoes: "passa" | "não passa" };

export function veredito(razao: number): Veredito {
  return {
    textoPequeno: razao >= 7 ? "AAA" : razao >= 4.5 ? "AA" : "não passa",
    textoGrande: razao >= 4.5 ? "AAA" : razao >= 3 ? "AA" : "não passa",
    iconesEBotoes: razao >= 3 ? "passa" : "não passa",
  };
}

/** Matrizes de Machado et al. (severidade total), aplicadas em RGB linear. */
export const DALTONISMOS = {
  protanopia: { nome: "Protanopia (sem vermelho)", m: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]] },
  deuteranopia: { nome: "Deuteranopia (sem verde)", m: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]] },
  tritanopia: { nome: "Tritanopia (sem azul)", m: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]] },
} as const;
export type Daltonismo = keyof typeof DALTONISMOS;

export function simularDaltonismo(hex: string, tipo: Daltonismo): string {
  const [r, g, b] = hexParaRgb(hex).map(linear);
  const saida = DALTONISMOS[tipo].m.map((l) => l[0] * r + l[1] * g + l[2] * b);
  const gama = (v: number) => { const x = limitar(v, 0, 1); return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055); };
  return rgbParaHex(gama(saida[0]), gama(saida[1]), gama(saida[2]));
}

// ─── É a cor da marca? ─────────────────────────────────────────────────────

export type CorDaMarca = { nome: string; hex: string; status: "ready" | "draft"; pagina: number | null; cmyk: string | null; pms: string | null; rgb: string | null };

/** Até onde a diferença é a mesma cor, e até onde ninguém percebe a olho. */
export const LIMITE_IGUAL = 1;
export const LIMITE_IMPERCEPTIVEL = 2.3;

export type Comparacao =
  | { tipo: "sem-paleta" }
  | { tipo: "igual" | "quase" | "diferente"; cor: CorDaMarca; delta: number; aprovada: boolean };

/**
 * Compara com a paleta, em três passos:
 *   1. uma APROVADA dentro do imperceptível responde ("é a Brasa");
 *   2. senão, uma em RASCUNHO dentro do imperceptível responde identificada —
 *      rascunho nunca vira "cor da marca";
 *   3. senão, "não é cor da marca", com a aprovada mais próxima (ou, sem
 *      nenhuma aprovada, a mais próxima de todas).
 */
export function compararComAMarca(hex: string, paleta: readonly CorDaMarca[]): Comparacao {
  const comHex = paleta.filter((c) => /^#[0-9A-F]{6}$/i.test(c.hex));
  if (comHex.length === 0) return { tipo: "sem-paleta" };
  const maisProxima = (cores: CorDaMarca[]) =>
    cores.map((cor) => ({ cor, delta: deltaE2000(hex, cor.hex) })).sort((a, b) => a.delta - b.delta)[0];
  const aprovada = maisProxima(comHex.filter((c) => c.status === "ready"));
  const rascunho = maisProxima(comHex.filter((c) => c.status !== "ready"));
  const tipo = (d: number) => (d <= LIMITE_IGUAL ? "igual" : "quase") as "igual" | "quase";

  if (aprovada && aprovada.delta <= LIMITE_IMPERCEPTIVEL) return { tipo: tipo(aprovada.delta), ...aprovada, aprovada: true };
  if (rascunho && rascunho.delta <= LIMITE_IMPERCEPTIVEL) return { tipo: tipo(rascunho.delta), ...rascunho, aprovada: false };
  const referencia = aprovada ?? rascunho!;
  return { tipo: "diferente", ...referencia, aprovada: referencia.cor.status === "ready" };
}

/** A resposta em português, não em número. */
export function fraseDaComparacao(c: Comparacao): string {
  if (c.tipo === "sem-paleta") return "A paleta desta marca ainda não tem cores com código HEX no Brennimark.";
  const pagina = c.cor.pagina ? ` — manual, p. ${c.cor.pagina}` : "";
  const nome = `${c.cor.nome} (${c.cor.hex.toUpperCase()})`;
  if (!c.aprovada) {
    return c.tipo === "diferente"
      ? `Não é uma cor da marca. A mais próxima é ${nome}, que ainda está em rascunho no manual.`
      : `Parecida com ${nome}, que ainda está em RASCUNHO no manual — não vale como cor da marca até ser aprovada${pagina}.`;
  }
  if (c.tipo === "igual") return `É ${nome}, aprovada${pagina}.`;
  if (c.tipo === "quase") return `Praticamente ${nome}: a diferença é imperceptível a olho${pagina}.`;
  return `Não é uma cor da marca. A mais próxima é ${nome}, e a diferença é visível.`;
}

// ─── Levar para o trabalho ─────────────────────────────────────────────────

export type CorNomeada = { nome: string; hex: string };

export function slugDaCor(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cor";
}

export function paletaEmCss(cores: readonly CorNomeada[]): string {
  const usados = new Set<string>();
  const linhas = cores.map((c) => {
    let s = slugDaCor(c.nome);
    for (let n = 2; usados.has(s); n++) s = `${slugDaCor(c.nome)}-${n}`;
    usados.add(s);
    return `  --${s}: ${c.hex.toUpperCase()};`;
  });
  return `:root {\n${linhas.join("\n")}\n}\n`;
}

export function paletaEmJson(cores: readonly CorNomeada[]): string {
  return JSON.stringify(cores.map((c) => {
    const [r, g, b] = hexParaRgb(c.hex);
    return { nome: c.nome, hex: c.hex.toUpperCase(), rgb: [r, g, b], hsb: rgbParaHsb(r, g, b), cmyk_aproximado_couche: rgbParaCmyk(r, g, b, "couche") };
  }), null, 2) + "\n";
}

export function paletaEmTexto(cores: readonly CorNomeada[]): string {
  return cores.map((c) => `${c.nome} ${c.hex.toUpperCase()}`).join("\n");
}

/**
 * Adobe Swatch Exchange (.ase): abre no Illustrator, InDesign e Photoshop.
 * Cabeçalho "ASEF" 1.0 + um bloco de cor por amostra (nome em UTF-16 com fim
 * nulo, modelo "RGB ", três float32, tipo "normal"). Tudo big-endian.
 */
export function paletaEmAse(cores: readonly CorNomeada[]): Uint8Array {
  const blocos = cores.map((c) => {
    const nome = c.nome.slice(0, 60) + "\0";
    const corpo = new DataView(new ArrayBuffer(2 + nome.length * 2 + 4 + 12 + 2));
    let o = 0;
    corpo.setUint16(o, nome.length); o += 2;
    for (const ch of nome) { corpo.setUint16(o, ch.charCodeAt(0)); o += 2; }
    for (const ch of "RGB ") { corpo.setUint8(o, ch.charCodeAt(0)); o += 1; }
    for (const v of hexParaRgb(c.hex)) { corpo.setFloat32(o, v / 255); o += 4; }
    corpo.setUint16(o, 2); // normal
    const cabecalho = new DataView(new ArrayBuffer(6));
    cabecalho.setUint16(0, 0x0001); // bloco de cor
    cabecalho.setUint32(2, corpo.byteLength);
    return [new Uint8Array(cabecalho.buffer), new Uint8Array(corpo.buffer)];
  }).flat();
  const topo = new DataView(new ArrayBuffer(12));
  "ASEF".split("").forEach((ch, i) => topo.setUint8(i, ch.charCodeAt(0)));
  topo.setUint16(4, 1); topo.setUint16(6, 0); topo.setUint32(8, cores.length);
  const partes = [new Uint8Array(topo.buffer), ...blocos];
  const total = partes.reduce((s, p) => s + p.byteLength, 0);
  const saida = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { saida.set(p, o); o += p.byteLength; }
  return saida;
}
