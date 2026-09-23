import type { Trecho } from "./recuperacao";

/**
 * O copiloto de criação — fatia 4c (ADR-0004 §3.1 e §3.2).
 *
 * Compõe o prompt para uma ferramenta generativa a partir do que a marca
 * documentou. A regra que organiza tudo:
 *
 * > **Só regra aprovada entra num prompt em silêncio.** Rascunho pode ser
 * > oferecido, mas identificado, e POR ESCOLHA da pessoa.
 *
 * Por isso a decisão do que entra é feita AQUI, no servidor, e não pedida ao
 * modelo: ele recebe só as regras permitidas. Um rascunho que a pessoa não
 * marcou nem chega ao modelo — não há como ele "usar sem avisar".
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export const TIPOS_DE_PROMPT = ["imagem", "video", "texto"] as const;
export type TipoDePrompt = (typeof TIPOS_DE_PROMPT)[number];

export function ehTipoDePrompt(v: unknown): v is TipoDePrompt {
  return typeof v === "string" && (TIPOS_DE_PROMPT as readonly string[]).includes(v);
}

export const MAX_CARACTERES_DA_DESCRICAO = 500;

/** O cabeçalho com as regras que o prompt usou — a procedência, para a janela. */
export const CABECALHO_DE_REGRAS = "X-Brennimark-Regras";

export type RegraResumida = { slug: string; titulo: string; status: string; pagina: number | null };

/** Defensivo: cabeçalho ausente ou adulterado vira lista vazia. */
export function lerCabecalhoDeRegras(valor: string | null): RegraResumida[] {
  if (!valor) return [];
  try {
    const bruto: unknown = JSON.parse(decodeURIComponent(valor));
    if (!Array.isArray(bruto)) return [];
    return bruto.filter((r): r is RegraResumida =>
      !!r && typeof r === "object" && typeof (r as RegraResumida).slug === "string"
      && typeof (r as RegraResumida).titulo === "string" && typeof (r as RegraResumida).status === "string",
    ).map((r) => ({ slug: r.slug, titulo: r.titulo, status: r.status, pagina: Number.isInteger(r.pagina) ? r.pagina : null }));
  } catch {
    return [];
  }
}

/**
 * O que buscar no manual: a descrição, mais os termos do que costuma governar
 * aquele tipo de peça. Em inglês E português — o manual pode estar em
 * qualquer um dos dois, e a busca é por palavra.
 */
const TERMOS: Record<TipoDePrompt, string> = {
  imagem: "colour color palette photography photographic style image logo composition cor paleta fotografia estilo imagem",
  video: "colour color palette motion video photography style logo cor paleta vídeo movimento estilo",
  texto: "tone of voice writing copy language headline tom de voz texto escrita linguagem título",
};

export function consultaDoPrompt(descricao: string, tipo: TipoDePrompt): string {
  return `${descricao.trim().slice(0, MAX_CARACTERES_DA_DESCRICAO)} ${TERMOS[tipo]}`;
}

export type RegraDoPrompt = {
  slug: string;
  titulo: string;
  status: string;
  pagina: number | null;
  /** O texto da regra, para o modelo. Nunca vai ao navegador na lista. */
  conteudo: string;
};

/** Os trechos, agrupados por documento: uma regra por seção do manual. */
export function regrasDosTrechos(trechos: readonly Trecho[]): RegraDoPrompt[] {
  const porSlug = new Map<string, RegraDoPrompt>();
  for (const t of trechos) {
    const atual = porSlug.get(t.documentSlug);
    if (atual) {
      atual.conteudo += `\n${t.content}`;
      if (t.pageStart !== null && (atual.pagina === null || t.pageStart < atual.pagina)) atual.pagina = t.pageStart;
    } else {
      porSlug.set(t.documentSlug, {
        slug: t.documentSlug, titulo: t.documentTitle, status: t.status, pagina: t.pageStart, conteudo: t.content,
      });
    }
  }
  return [...porSlug.values()];
}

/** Aprovada é `ready`, e só ela. `draft` e `pending` são rascunho para o copiloto. */
export function separarRegras(regras: readonly RegraDoPrompt[]) {
  return {
    aprovadas: regras.filter((r) => r.status === "ready"),
    rascunhos: regras.filter((r) => r.status !== "ready"),
  };
}

/**
 * O que o modelo pode receber: todas as aprovadas, mais os rascunhos que a
 * pessoa marcou.
 *
 * ⚖️ `escolhidos` vem do navegador e é tratado como dado não confiável: só vale
 * slug que ESTÁ entre os rascunhos recuperados agora. Um slug inventado, ou de
 * outra marca, simplesmente não casa — o conteúdo sai sempre da busca do
 * servidor, nunca do pedido.
 */
export function regrasPermitidas(regras: readonly RegraDoPrompt[], escolhidos: unknown): RegraDoPrompt[] {
  const { aprovadas, rascunhos } = separarRegras(regras);
  const marcados = new Set(Array.isArray(escolhidos) ? escolhidos.filter((s): s is string => typeof s === "string") : []);
  return [...aprovadas, ...rascunhos.filter((r) => marcados.has(r.slug))];
}

/** A lista que vai ao navegador: sem o conteúdo, que é do modelo. */
export function resumoDasRegras(regras: readonly RegraDoPrompt[]) {
  return regras.map(({ slug, titulo, status, pagina }) => ({ slug, titulo, status, pagina }));
}

const DESTINO: Record<TipoDePrompt, [string, string]> = {
  imagem: ["an image generation model (Midjourney, Firefly, DALL·E, Imagen)", "a imagem"],
  video: ["a video generation model (Veo, Runway, Sora, Kling)", "o vídeo"],
  texto: ["a language model that will write copy for the brand", "o texto"],
};

/**
 * As instruções do modelo. O prompt de imagem e vídeo sai em inglês — é a
 * língua em que esses motores rendem melhor; o de texto, na língua da
 * descrição, porque é ele que vai escrever para o público da marca.
 */
export function sistemaDoCopiloto(regras: readonly RegraDoPrompt[], tipo: TipoDePrompt, marca: string): string {
  const blocos = regras.map((r) =>
    `<rule title="${r.titulo.replace(/"/g, "'")}" status="${r.status}"${r.pagina ? ` page="${r.pagina}"` : ""}>\n${r.conteudo.slice(0, 1500)}\n</rule>`,
  ).join("\n\n");

  return [
    `You write ONE prompt for ${DESTINO[tipo][0]}, for the brand "${marca}".`,
    "",
    "Hard rules:",
    "- Brand facts (exact hex codes, colour names, allowed and forbidden styles, logo usage, tone of voice) may come ONLY from the <rule> blocks below. Never add a brand fact that is not written there. If the rules do not cover something, leave it to the description — do not invent it.",
    "- Use hex codes and names exactly as written in the rules.",
    "- Turn prohibitions in the rules into explicit negative instructions (\"avoid …\", \"do not …\").",
    "- The creative subject comes from the person's description; the rules only constrain it.",
    tipo === "texto"
      ? "- Write the prompt in the same language as the person's description."
      : "- Write the prompt in English: generative image and video models follow English best.",
    "- Output ONLY the prompt itself: no preamble, no explanation, no markdown, no list of sources.",
    "",
    regras.length > 0 ? blocos : "(no brand rules were provided — use only the description, and do not invent brand facts)",
  ].join("\n");
}
