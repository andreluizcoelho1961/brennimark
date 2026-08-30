import type { DocPageEntry } from "../../content/docs";

/**
 * Do texto de um PDF para um rascunho revisável.
 *
 * Duas regras atravessam este módulo.
 *
 * A primeira: **extração automática não é aprovação**. Toda página nasce
 * `draft`, sem exceção e sem opção. O que saiu de um PDF por heurística não
 * pode aparecer como regra estabelecida antes de alguém confirmar — é a mesma
 * promessa de procedência que o resto do produto faz.
 *
 * A segunda: o importador não inventa. Página sem texto vira aviso, não texto
 * inventado; título ausente vira "Página N", que é honesto; e nada que o PDF
 * não diga entra no rascunho.
 */
export interface PaginaExtraida {
  numero: number;
  linhas: string[];
}

export interface AvisoDeImportacao {
  pagina: number;
  tipo: "sem-texto" | "sem-titulo" | "texto-curto";
  detalhe: string;
}

export interface RascunhoDeImportacao {
  documentos: DocPageEntry[];
  avisos: AvisoDeImportacao[];
  /** Páginas do PDF que não produziram documento. */
  ignoradas: number[];
}

const LIMITE_TITULO = 120;
const LIMITE_PARAGRAFOS = 40;
const LIMITE_CARACTERES = 4000;

export function slugify(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * A primeira linha curta é o título; o resto é corpo.
 *
 * Heurística deliberadamente simples e visível na prévia. Um extrator mais
 * esperto erraria de formas mais difíceis de perceber, e quem revisa não teria
 * como saber o que ele decidiu sozinho.
 */
function tituloDe(linhas: string[]): string | null {
  const candidata = linhas.find((linha) => linha.length > 0 && linha.length <= LIMITE_TITULO);
  return candidata ?? null;
}

export function construirRascunho(
  paginas: readonly PaginaExtraida[],
  { grupoPadrao = "Manual" }: { grupoPadrao?: string } = {},
): RascunhoDeImportacao {
  const documentos: DocPageEntry[] = [];
  const avisos: AvisoDeImportacao[] = [];
  const ignoradas: number[] = [];
  const slugsUsados = new Set<string>();

  for (const pagina of paginas) {
    const linhas = pagina.linhas.map((l) => l.trim()).filter(Boolean);

    if (linhas.length === 0) {
      // Página só com imagem, ou digitalizada sem OCR. Ela existe no PDF e não
      // vira documento — dizer isso é melhor que criar página vazia.
      avisos.push({
        pagina: pagina.numero,
        tipo: "sem-texto",
        detalhe: "Nenhum texto extraível. A página pode ser uma imagem.",
      });
      ignoradas.push(pagina.numero);
      continue;
    }

    const titulo = tituloDe(linhas);
    if (!titulo) {
      avisos.push({
        pagina: pagina.numero,
        tipo: "sem-titulo",
        detalhe: "Nenhuma linha curta o bastante para ser título.",
      });
    }

    const tituloFinal = (titulo ?? `Página ${pagina.numero}`).slice(0, LIMITE_TITULO);
    const corpo = linhas
      .filter((linha) => linha !== titulo)
      .map((linha) => linha.slice(0, LIMITE_CARACTERES))
      .slice(0, LIMITE_PARAGRAFOS);

    if (corpo.length === 0) {
      avisos.push({
        pagina: pagina.numero,
        tipo: "texto-curto",
        detalhe: "Só o título foi extraído. Revise antes de publicar.",
      });
    }

    // Slug estável e único: duas páginas com o mesmo título são comuns num
    // manual, e sobrescrever uma com a outra perderia conteúdo em silêncio.
    let slug = slugify(tituloFinal) || `pagina-${pagina.numero}`;
    if (slugsUsados.has(slug)) slug = `${slug}-${pagina.numero}`;
    slugsUsados.add(slug);

    documentos.push({
      slug,
      group: grupoPadrao,
      title: tituloFinal,
      // Sem exceção: o que veio de heurística não nasce aprovado.
      status: "draft",
      body: corpo,
    });
  }

  return { documentos, avisos, ignoradas };
}

/** O que a prévia mostra antes de qualquer escrita. */
export interface Previa {
  paginasNoPdf: number;
  documentos: DocPageEntry[];
  avisos: AvisoDeImportacao[];
  ignoradas: number[];
  erros: string[];
}

export function montarPrevia(
  paginas: readonly PaginaExtraida[],
  opcoes?: { grupoPadrao?: string },
): Previa {
  const rascunho = construirRascunho(paginas, opcoes);
  const erros: string[] = [];

  if (paginas.length === 0) erros.push("O arquivo não tem páginas.");
  if (rascunho.documentos.length === 0 && paginas.length > 0) {
    erros.push("Nenhuma página do PDF tem texto extraível. Nada seria importado.");
  }

  return {
    paginasNoPdf: paginas.length,
    documentos: rascunho.documentos,
    avisos: rascunho.avisos,
    ignoradas: rascunho.ignoradas,
    erros,
  };
}
