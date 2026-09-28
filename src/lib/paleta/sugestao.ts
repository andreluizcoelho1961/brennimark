import type { Trecho } from "../ai/recuperacao";
import { CODIGO_MAXIMO, NOME_MAXIMO, SEGMENTO_MAXIMO, normalizarHex, type CorEscrita } from "./paleta";

/**
 * A ficha da paleta SUGERIDA pela IA — decisão do André, 27/09/2026.
 *
 * Cadastrar 19 cores com quatro códigos cada, à mão, é o trabalho que ninguém
 * faz. Com as imagens de leitura das páginas (#50), a IA lê a tabela de
 * amostras como uma pessoa lê, e devolve as cores. Duas decisões do André:
 *
 *   1. cada cor guarda a ORIGEM — "ia" ou "pessoa" —, porque "quem leu este
 *      código?" é pergunta legítima numa auditoria do dono da marca;
 *   2. a sugestão só ACRESCENTA o que falta: não mexe em cor já cadastrada,
 *      muito menos em aprovada.
 *
 * E uma que não se discute: a sugestão nasce RASCUNHO (o banco garante). A IA
 * pode trocar um dígito de um CMYK lendo imagem, e código errado aprovado vai
 * direto ao prompt do designer.
 *
 * Tudo aqui é puro, sem rede: a rota faz as chamadas, e isto decide.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

/** Quantas páginas a IA lê por sugestão. Cada imagem custa ~1.100–2.300 tokens. */
export const MAXIMO_DE_PAGINAS_DA_SUGESTAO = 4;
/** Um trecho que cobre uma seção longa entra só pelas primeiras páginas. */
const PAGINAS_POR_TRECHO = 3;
/** Teto de cores numa sugestão: além disso não é paleta, é catálogo. */
export const MAXIMO_DE_CORES_SUGERIDAS = 60;

const CODIGOS = [
  /#[0-9a-f]{6}\b/gi,
  /\b(?:pantone|pms)\b/gi,
  /\bcmyk\b/gi,
  /\brgb\b/gi,
  /\bhex(?:adecimal)?\b/gi,
  /\b[cmyk]\s?\d{1,3}\b/gi,
];
const TITULO_DE_COR = /\b(?:cor|cores|paleta|colou?rs?|palette|crom[aá]tic[oa])\b/i;

/** Quanto um texto tem cara de página de paleta: códigos de cor contados. */
export function pontuarCodigosDeCor(texto: string): number {
  return CODIGOS.reduce((soma, padrao) => soma + (texto.match(padrao)?.length ?? 0), 0);
}

/**
 * As páginas do manual onde a paleta está, a partir do texto já indexado —
 * sem abrir o PDF. Vence o trecho com mais códigos de cor; título de seção
 * sobre cor desempata. Nenhum trecho com cara de paleta = lista vazia, e a
 * tela pede que a pessoa diga as páginas.
 */
export function paginasDaPaleta(trechos: readonly Trecho[], maximo = MAXIMO_DE_PAGINAS_DA_SUGESTAO): number[] {
  const pontuados = trechos
    .filter((t) => t.pageStart !== null)
    .map((t) => {
      const codigos = pontuarCodigosDeCor(t.content);
      const titulo = TITULO_DE_COR.test(`${t.documentTitle} ${t.section ?? ""}`) ? 1 : 0;
      return { t, codigos, titulo };
    })
    .filter((p) => p.codigos >= 2)
    .sort((a, b) => b.codigos - a.codigos || b.titulo - a.titulo || a.t.pageStart! - b.t.pageStart!);

  const paginas: number[] = [];
  for (const { t } of pontuados) {
    const fim = Math.min(t.pageEnd ?? t.pageStart!, t.pageStart! + PAGINAS_POR_TRECHO - 1);
    for (let p = t.pageStart!; p <= fim; p++) {
      if (!paginas.includes(p)) paginas.push(p);
      if (paginas.length >= maximo) return paginas.sort((a, b) => a - b);
    }
  }
  return paginas.sort((a, b) => a - b);
}

export type PaginasPedidas = { ok: true; paginas: number[] } | { ok: false; motivo: "formato" | "demais" | "fora-do-manual" };

/** "21, 22" digitado na tela → páginas conferidas contra o manual atual. */
export function lerPaginasPedidas(valor: unknown, paginasDoManual: number | null): PaginasPedidas {
  if (valor === undefined || valor === null || valor === "") return { ok: true, paginas: [] };
  const partes = String(valor).split(/[,;\s]+/).filter(Boolean);
  const numeros = partes.map(Number);
  if (numeros.some((n) => !Number.isInteger(n) || n < 1)) return { ok: false, motivo: "formato" };
  const unicas = [...new Set(numeros)].sort((a, b) => a - b);
  if (unicas.length > MAXIMO_DE_PAGINAS_DA_SUGESTAO) return { ok: false, motivo: "demais" };
  if (paginasDoManual !== null && unicas.some((n) => n > paginasDoManual)) return { ok: false, motivo: "fora-do-manual" };
  return { ok: true, paginas: unicas };
}

/**
 * O que a IA recebe. A regra que mais importa: códigos COMO ESTÃO IMPRESSOS,
 * nunca convertidos — um HEX calculado a partir do CMYK parece dado do manual
 * e não é.
 */
export function instrucoesDaSugestao(ingles: boolean, paginas: readonly number[]): string {
  const lista = paginas.join(", ");
  return ingles
    ? `You read brand manual pages and transcribe the brand color palette. The images are manual pages ${lista}, in this order.

Rules:
- Transcribe ONLY colors that appear in these pages as part of the brand palette (swatches with a name or codes). Ignore colors of photos and illustrations.
- Copy each code EXACTLY as printed, letters included (e.g. "C0 M100 Y75 K4", "R204 G9 B47", "PMS 186"). Never convert or calculate a code: if the page shows CMYK but no HEX, the HEX field is "-".
- Role is "principal" only when the manual calls the color primary, main, institutional or equivalent; otherwise "apoio".
- Segment: the column or group the manual puts the color under (e.g. a business line). A color outside every group (e.g. a strip shared by all) → "-".
- Page: the page number (from the list above) where the color appears.
- Answer with ONE LINE PER COLOR and nothing else — no title, no explanation, no JSON:
name | role | segment | HEX | RGB | CMYK | PMS | page
- Use "-" for a field that isn't printed. No palette in these pages → answer only: NENHUMA`
    : `Você lê páginas de manual de marca e transcreve a paleta de cores da marca. As imagens são as páginas ${lista} do manual, nesta ordem.

Regras:
- Transcreva SÓ as cores que aparecem nestas páginas como parte da paleta da marca (amostras com nome ou códigos). Ignore cores de fotos e ilustrações.
- Copie cada código EXATAMENTE como está impresso, inclusive as letras (ex.: "C0 M100 Y75 K4", "R204 G9 B47", "PMS 186"). Nunca converta nem calcule um código: se a página mostra CMYK e não mostra HEX, o campo HEX é "-".
- Papel é "principal" só quando o manual chama a cor de principal, primária, institucional ou equivalente; senão, "apoio".
- Segmento: a coluna ou o grupo em que o manual põe a cor (ex.: uma linha de negócio). Cor fora de qualquer grupo (ex.: uma faixa comum a todos) → "-".
- Página: o número da página (da lista acima) em que a cor aparece.
- Responda com UMA LINHA POR COR e nada mais — sem título, sem explicação, sem JSON:
nome | papel | segmento | HEX | RGB | CMYK | PMS | página
- Use "-" no campo que não está impresso. Sem paleta nestas páginas → responda só: NENHUMA`;
}

/**
 * Por que LINHAS e não JSON (ensaio de 27/09/2026): a primeira sugestão real,
 * no Bradesco, gastou 1.948 dos 2.000 tokens de saída e não entregou cor
 * nenhuma. JSON com chaves e nulos custa ~3 vezes mais por cor, e o Gemini
 * ainda raciocina antes — e o raciocínio conta como saída. Em linha, uma
 * resposta cortada perde só a última cor, não todas.
 */
function deLinhas(texto: string, diagnostico?: DiagnosticoDaSugestao): Record<string, unknown>[] {
  const vazio = (v: string | undefined) => (v === undefined || /^[-–—]?$/.test(v.trim()) || /^null$/i.test(v.trim()) ? null : v.trim());
  const itens: Record<string, unknown>[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    if (!linha.includes("|")) continue;
    // Tabela Markdown: "| a | b |" — o "|" das pontas não é coluna. E a linha
    // separadora ("|---|---|") não é cor.
    const semPontas = linha.trim().replace(/^\|/, "").replace(/\|$/, "");
    if (/^[\s|:\-–—]*$/.test(semPontas)) continue;
    const campos = semPontas.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").split("|").map((c) => c.trim());
    // Cabeçalho repetido ("nome | papel…") não é cor.
    if (/^(nome|name)$/i.test(campos[0])) continue;
    if (campos.length < 8) {
      if (diagnostico) diagnostico.recusadas.formato += 1;
      continue;
    }
    const [nome, papel, segmento, hex, rgb, cmyk, pms, pagina] = campos;
    itens.push({ nome, papel: (papel ?? "").toLowerCase(), segmento: vazio(segmento) ?? "", hex: vazio(hex), rgb: vazio(rgb), cmyk: vazio(cmyk), pms: vazio(pms), pagina: vazio(pagina) });
  }
  return itens;
}

/**
 * Os objetos `{...}` completos de um texto, mesmo que ele tenha sido cortado
 * no meio: resposta interrompida pelo teto de saída ainda entrega as cores que
 * terminou de escrever, em vez de nenhuma.
 */
function objetosCompletos(texto: string): unknown[] {
  const objetos: unknown[] = [];
  const inicios: number[] = [];
  let emTexto = false;
  let escapado = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (emTexto) {
      if (escapado) escapado = false;
      else if (c === "\\") escapado = true;
      else if (c === '"') emTexto = false;
      continue;
    }
    if (c === '"') emTexto = true;
    else if (c === "{") inicios.push(i);
    else if (c === "}" && inicios.length > 0) {
      const inicio = inicios.pop()!;
      try {
        const objeto: unknown = JSON.parse(texto.slice(inicio, i + 1));
        // Só a cor tem nome; o invólucro {"cores": [...]} não entra.
        if (objeto && typeof objeto === "object" && typeof (objeto as { nome?: unknown }).nome === "string") objetos.push(objeto);
      } catch { /* objeto malformado: fica de fora */ }
    }
  }
  return objetos;
}

function comoLista(texto: string, diagnostico?: DiagnosticoDaSugestao): unknown[] {
  const limpo = texto.replace(/```(?:json|text|markdown)?/gi, "").trim();
  const linhas = deLinhas(limpo, diagnostico);
  if (linhas.length > 0) return linhas;
  // Reserva: modelo que insiste em JSON.
  try {
    const bruto: unknown = JSON.parse(limpo);
    if (Array.isArray(bruto)) return bruto;
    if (bruto && typeof bruto === "object" && Array.isArray((bruto as { cores?: unknown }).cores)) {
      return (bruto as { cores: unknown[] }).cores;
    }
    return [];
  } catch {
    return objetosCompletos(limpo);
  }
}

export type CorSugerida = Omit<CorEscrita, "ordem">;

/**
 * O que a leitura fez com a resposta — medida, sem o conteúdo (ensaio de
 * 27/09: a p. 22 do Bradesco voltou 17 linhas e ZERO cores, e o log não dizia
 * por quê).
 */
export type DiagnosticoDaSugestao = {
  recusadas: { formato: number; "sem-codigo": number };
  camposDescartados: { hex: number; "codigo-longo": number };
  semNome: number;
};

/** "INSTITUCIONAL / VAREJO" → "Institucional / Varejo": o nome não grita. */
function legivel(texto: string): string {
  if (texto !== texto.toUpperCase()) return texto;
  const miudas = new Set(["de", "da", "do", "das", "dos", "e", "of", "and", "the"]);
  return texto.toLowerCase().split(/(\s+|\/)/).map((parte, i) =>
    i > 0 && miudas.has(parte) ? parte : parte.charAt(0).toUpperCase() + parte.slice(1)).join("");
}

function diagnosticoVazio(): DiagnosticoDaSugestao {
  return { recusadas: { formato: 0, "sem-codigo": 0 }, camposDescartados: { hex: 0, "codigo-longo": 0 }, semNome: 0 };
}

function aparado(valor: unknown, maximo: number): string | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  const limpo = String(valor).trim().replace(/\s+/g, " ");
  if (limpo === "" || /^[-–—]$/.test(limpo) || /^null$/i.test(limpo)) return null;
  return limpo.length > maximo ? null : limpo;
}

/**
 * Uma cor lida pela IA → uma cor que o banco aceita, CAMPO A CAMPO.
 *
 * Transcrição não é cadastro: a IA pode ler um dígito a menos num HEX, e
 * recusar a cor inteira por isso jogava fora os outros três códigos, que
 * estavam certos. Aqui o campo duvidoso sai e o resto fica — a cor é rascunho
 * e uma pessoa confere de qualquer jeito. Só não entra cor sem código nenhum.
 *
 * Tom sem nome impresso (tabelas de amostras costumam ter só códigos) ganha
 * como nome o primeiro código: "PMS 7545 C".
 */
function corDaSugestao(
  bruto: Record<string, unknown>,
  paginasEnviadas: readonly number[],
  d: DiagnosticoDaSugestao,
  contadores: Map<string, number>,
  ingles: boolean,
): CorSugerida | null {
  const hexBruto = aparado(bruto.hex, 40);
  const hex = hexBruto === null ? null : normalizarHex(hexBruto);
  if (hexBruto !== null && hex === null) d.camposDescartados.hex += 1;

  const codigo = (valor: unknown) => {
    const lido = aparado(valor, 1_000);
    if (lido !== null && lido.length > CODIGO_MAXIMO) {
      d.camposDescartados["codigo-longo"] += 1;
      return null;
    }
    return lido;
  };
  const rgb = codigo(bruto.rgb);
  const cmyk = codigo(bruto.cmyk);
  const pms = codigo(bruto.pms);
  if (hex === null && rgb === null && cmyk === null && pms === null) {
    d.recusadas["sem-codigo"] += 1;
    return null;
  }

  const segmento = aparado(bruto.segmento, SEGMENTO_MAXIMO) ?? "";
  let nome = aparado(bruto.nome, NOME_MAXIMO);
  if (nome === null) {
    d.semNome += 1;
    // Tom sem nome impresso (27/09): branco e preto pelo nome; o resto pela
    // coluna e pela posição — "Todos 3" diz onde a cor está, o código não.
    if (hex === "#FFFFFF") nome = ingles ? "White" : "Branco";
    else if (hex === "#000000") nome = ingles ? "Black" : "Preto";
    else {
      const grupo = segmento ? legivel(segmento) : (ingles ? "Support" : "Apoio");
      const n = (contadores.get(grupo) ?? 0) + 1;
      contadores.set(grupo, n);
      nome = `${grupo} ${n}`.slice(0, NOME_MAXIMO);
    }
  }

  // "22", "p. 22", 22: o número é o que importa.
  const numero = Number(String(bruto.pagina ?? "").replace(/\D/g, "") || NaN);
  const pagina = paginasEnviadas.includes(numero) ? numero : paginasEnviadas.length === 1 ? paginasEnviadas[0] : null;

  return {
    nome,
    papel: String(bruto.papel ?? "").toLowerCase() === "principal" ? "principal" : "apoio",
    segmento,
    hex, rgb, cmyk, pms, pagina,
  };
}

export function lerSugestaoComDiagnostico(
  texto: string,
  paginasEnviadas: readonly number[],
  ingles = false,
): { cores: CorSugerida[]; diagnostico: DiagnosticoDaSugestao } {
  const diagnostico = diagnosticoVazio();
  const contadores = new Map<string, number>();
  const cores: CorSugerida[] = [];
  for (const item of comoLista(texto, diagnostico).slice(0, MAXIMO_DE_CORES_SUGERIDAS)) {
    if (!item || typeof item !== "object") continue;
    const cor = corDaSugestao(item as Record<string, unknown>, paginasEnviadas, diagnostico, contadores, ingles);
    if (cor) cores.push(cor);
  }
  return { cores, diagnostico };
}

/** As cores lidas, sem o diagnóstico. */
export function lerSugestao(texto: string, paginasEnviadas: readonly number[]): CorSugerida[] {
  return lerSugestaoComDiagnostico(texto, paginasEnviadas).cores;
}

/** Nome comparável: sem acento, sem caixa, espaços únicos. */
export function chaveDoNome(nome: string): string {
  return nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Só o que FALTA na ficha — decisão do André, 27/09. Uma sugestão é repetida
 * quando já existe cor com o mesmo HEX ou com o mesmo nome; também não se
 * repete dentro da própria sugestão. Cor existente nunca é tocada.
 */
export function soOQueFalta(
  sugeridas: readonly CorSugerida[],
  existentes: readonly { nome: string; hex: string | null }[],
): { novas: CorSugerida[]; repetidas: number } {
  const hexes = new Set(existentes.map((c) => c.hex).filter((h): h is string => h !== null));
  const nomes = new Set(existentes.map((c) => chaveDoNome(c.nome)));
  const novas: CorSugerida[] = [];
  let repetidas = 0;
  for (const cor of sugeridas) {
    const nome = chaveDoNome(cor.nome);
    if ((cor.hex !== null && hexes.has(cor.hex)) || nomes.has(nome)) {
      repetidas += 1;
      continue;
    }
    novas.push(cor);
    nomes.add(nome);
    if (cor.hex !== null) hexes.add(cor.hex);
  }
  return { novas, repetidas };
}
