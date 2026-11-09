import {
  DALTONISMOS, contraste, deltaE2000, linear, rgbParaHex, simularDaltonismo, veredito,
  type Daltonismo, type Veredito,
} from "./cores";

/**
 * Acessibilidade DENTRO de uma peça — fatias 2, 3 e 4 (06/11/2026).
 *
 * Tudo aqui é conta feita no navegador de quem analisa, sobre pixels que a
 * PESSOA escolheu na peça: nada vai a servidor e nenhuma IA entra. Por isso a
 * regra do prompt de visão ("não afirme HEX lido da imagem") não é violada: o
 * valor é medido pela plataforma, e a tela diz que é amostra da peça — uma
 * imagem comprimida (JPEG) pode variar alguns pontos de um pixel para outro.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

// ─── Fatia 2: amostrar e medir ──────────────────────────────────────────────

/**
 * A cor de um ponto da peça: a MEDIANA, por canal, de um quadrado ao redor.
 * Um pixel só cai na borda serrilhada de uma letra e mente; a mediana pega a
 * cor que domina a vizinhança, e não faz média entre texto e fundo.
 */
export function amostrarMediana(dados: ArrayLike<number>, largura: number, altura: number, x: number, y: number, raio = 2): string {
  const canais: number[][] = [[], [], []];
  for (let j = Math.max(0, y - raio); j <= Math.min(altura - 1, y + raio); j++) {
    for (let i = Math.max(0, x - raio); i <= Math.min(largura - 1, x + raio); i++) {
      const p = (j * largura + i) * 4;
      for (let c = 0; c < 3; c++) canais[c].push(dados[p + c]);
    }
  }
  const mediana = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;
  return rgbParaHex(mediana(canais[0]), mediana(canais[1]), mediana(canais[2]));
}

export type UsoDoPar = "texto-comum" | "texto-grande" | "icones-e-botoes";
export const LIMITE_DO_USO: Record<UsoDoPar, number> = { "texto-comum": 4.5, "texto-grande": 3, "icones-e-botoes": 3 };

/** Truncada em 2 casas, como na paleta: 4,499 nunca aparece como 4,5. */
export const truncar2 = (v: number) => Math.floor(v * 100 + 1e-9) / 100;

export type MedidaDoPar = {
  razao: number;
  veredito: Veredito;
  /** A razão do mesmo par visto por quem tem cada tipo de daltonismo. */
  sobDaltonismo: Record<Daltonismo, number>;
};

export function medirPar(texto: string, fundo: string): MedidaDoPar {
  const razao = truncar2(contraste(texto, fundo));
  const sobDaltonismo = Object.fromEntries(
    (Object.keys(DALTONISMOS) as Daltonismo[]).map((tipo) => [tipo, truncar2(contraste(simularDaltonismo(texto, tipo), simularDaltonismo(fundo, tipo)))]),
  ) as Record<Daltonismo, number>;
  return { razao, veredito: veredito(razao), sobDaltonismo };
}

export function passaNoUso(razao: number, uso: UsoDoPar): boolean {
  return razao >= LIMITE_DO_USO[uso];
}

// ─── Fatia 3: a peça como a vê quem tem daltonismo ──────────────────────────

const TABELA_LINEAR = Float64Array.from({ length: 256 }, (_, i) => linear(i));

/**
 * Aplica a simulação a TODOS os pixels, no lugar. Mesma matriz (Machado et al.,
 * severidade total) e mesma conta de `simularDaltonismo`, mas com a conversão
 * para RGB linear em tabela — uma foto de 2 mil px tem milhões de pixels.
 */
export function simularPixels(dados: Uint8ClampedArray, tipo: Daltonismo): void {
  const m = DALTONISMOS[tipo].m;
  const gama = (v: number) => {
    const x = Math.min(1, Math.max(0, v));
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  };
  for (let p = 0; p < dados.length; p += 4) {
    const r = TABELA_LINEAR[dados[p]], g = TABELA_LINEAR[dados[p + 1]], b = TABELA_LINEAR[dados[p + 2]];
    dados[p] = gama(m[0][0] * r + m[0][1] * g + m[0][2] * b);
    dados[p + 1] = gama(m[1][0] * r + m[1][1] * g + m[1][2] * b);
    dados[p + 2] = gama(m[2][0] * r + m[2][1] * g + m[2][2] * b);
  }
}

/** Um par de cores que se distingue bem, mas deixa de se distinguir para quem tem o tipo. */
export type ParQueSeConfunde = { a: string; b: string; tipo: Daltonismo; diferencaNormal: number; diferencaSimulada: number };

/** Acima disto (ΔE 2000) o olho típico vê duas cores; abaixo, tende a ver uma só. */
export const DIFERENCA_VISIVEL = 20;
export const DIFERENCA_CONFUNDIDA = 10;

export function seConfundem(a: string, b: string): ParQueSeConfunde[] {
  const normal = deltaE2000(a, b);
  if (normal < DIFERENCA_VISIVEL) return [];
  return (Object.keys(DALTONISMOS) as Daltonismo[]).flatMap((tipo) => {
    const simulada = deltaE2000(simularDaltonismo(a, tipo), simularDaltonismo(b, tipo));
    return simulada < DIFERENCA_CONFUNDIDA ? [{ a, b, tipo, diferencaNormal: normal, diferencaSimulada: simulada }] : [];
  });
}

// ─── Fatia 4: ajuste só com cores aprovadas ─────────────────────────────────

export type CorAprovada = { nome: string; hex: string; status: "ready" | "draft" };
export type Sugestao = { nome: string; hex: string; razao: number; alvo: "texto" | "fundo" };

export type Ajuste =
  | { estado: "ja-passa" }
  | { estado: "sugestoes"; sugestoes: Sugestao[] }
  /** Nenhuma cor APROVADA resolve: não se inventa cor fora da paleta. */
  | { estado: "nenhuma" }
  /** Sem paleta aprovada para consultar. */
  | { estado: "sem-paleta" };

export const MAXIMO_POR_ALVO = 3;

/**
 * Cores da paleta que fariam o par passar no uso pedido, trocando o TEXTO ou o
 * FUNDO — as mais próximas do que está na peça primeiro (menor ΔE 2000), para
 * mexer o mínimo na identidade. Só entra cor APROVADA com HEX: rascunho não é
 * cor da marca (ADR-0004 §3.2), e a sugestão não vem de fora da paleta.
 */
export function sugerirAjuste(texto: string, fundo: string, uso: UsoDoPar, paleta: readonly CorAprovada[]): Ajuste {
  if (passaNoUso(truncar2(contraste(texto, fundo)), uso)) return { estado: "ja-passa" };
  const aprovadas = paleta.filter((c) => c.status === "ready" && /^#[0-9A-F]{6}$/i.test(c.hex));
  if (aprovadas.length === 0) return { estado: "sem-paleta" };

  const candidatas = (alvo: Sugestao["alvo"]) => {
    const fixa = alvo === "texto" ? fundo : texto;
    const atual = alvo === "texto" ? texto : fundo;
    return aprovadas
      .map((c) => ({ c, razao: truncar2(contraste(c.hex, fixa)), distancia: deltaE2000(c.hex, atual) }))
      .filter((x) => passaNoUso(x.razao, uso) && x.c.hex.toUpperCase() !== atual.toUpperCase())
      .sort((p, q) => p.distancia - q.distancia)
      .slice(0, MAXIMO_POR_ALVO)
      .map((x): Sugestao => ({ nome: x.c.nome, hex: x.c.hex.toUpperCase(), razao: x.razao, alvo }));
  };
  const sugestoes = [...candidatas("texto"), ...candidatas("fundo")];
  return sugestoes.length > 0 ? { estado: "sugestoes", sugestoes } : { estado: "nenhuma" };
}
