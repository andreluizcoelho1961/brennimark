import { Marked } from "marked";
import { IDIOMA_PADRAO_DO_SITE, caminhoDoSite, type IdiomaDoSite } from "../site/idiomas";

/**
 * Os artigos da Central de ajuda são Markdown em `src/content/ajuda/`. Este
 * arquivo é puro (sem leitura de disco), para ser testado de ponta a ponta.
 *
 * Um mesmo artigo serve a duas telas — o Kit/Cores/Grids gratuito do site e o
 * do assinante, dentro de uma marca — e elas diferem em trechos. Em vez de
 * dois arquivos que divergem com o tempo, o artigo marca o que é de cada uma:
 *
 *   :::site ... :::      bloco que só vale no gratuito
 *   :::marca ... :::     bloco que só vale dentro de uma marca
 *   {marca: texto}       o mesmo, no meio de uma frase
 *
 * `audiencia` escolhe a visão: "site", "marca", ou "tudo" (a página pública da
 * Central, que mostra as duas e diz de qual é cada trecho).
 */
export type Audiencia = "site" | "marca" | "tudo";

const ROTULO: Record<IdiomaDoSite, Record<"site" | "marca", string>> = {
  "pt-BR": { site: "No site, sem login", marca: "Dentro de uma marca" },
  en: { site: "On the site, no login", marca: "Inside a brand" },
};

export function filtrarPorAudiencia(md: string, audiencia: Audiencia, idioma: IdiomaDoSite = IDIOMA_PADRAO_DO_SITE): string {
  const rotulos = ROTULO[idioma];
  const blocos = md.replace(/^:::(site|marca)[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm, (_t, quem: "site" | "marca", dentro: string) => {
    if (audiencia === "tudo") {
      const citado = dentro.split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");
      return `> **${rotulos[quem]}**\n>\n${citado}`;
    }
    return audiencia === quem ? dentro : "";
  });
  return blocos.replace(/([ \t]*)\{(site|marca): ([^{}]*)\}/g, (_t, espaco: string, quem: "site" | "marca", texto: string) => {
    if (audiencia === "tudo") return `${espaco}(${rotulos[quem].toLowerCase()}: ${texto})`;
    return audiencia === quem ? `${espaco}${texto}` : "";
  });
}

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * HTML cru dentro do Markdown é mostrado como texto. O conteúdo é do
 * repositório e passa por revisão, mas o renderizador não deveria depender
 * disso: um `<script>` colado num artigo vira texto visível, não código.
 *
 * Os links internos são escritos uma vez, em português (`/ajuda/kit`), e saem
 * no endereço do idioma do leitor (`/en/help/kit`).
 */
function criarRenderizador(idioma: IdiomaDoSite) {
  return new Marked({
    gfm: true,
    renderer: {
      html: ({ text }) => escapar(text),
      link: function ({ href, tokens }) {
        const texto = this.parser.parseInline(tokens);
        const seguro = /^(\/|#|https:\/\/|mailto:)/.test(href) ? href : "#";
        const destino = seguro.startsWith("/") ? caminhoDoSite(idioma, seguro) : seguro;
        return `<a href="${escapar(destino)}">${texto}</a>`;
      },
    },
  });
}

const renderizadores = new Map<IdiomaDoSite, Marked>();

export function renderizarArtigo(md: string, audiencia: Audiencia, idioma: IdiomaDoSite = IDIOMA_PADRAO_DO_SITE): string {
  let marked = renderizadores.get(idioma);
  if (!marked) renderizadores.set(idioma, (marked = criarRenderizador(idioma)));
  return marked.parse(filtrarPorAudiencia(md, audiencia, idioma), { async: false });
}

/** O texto corrido do artigo, sem marcação — para a busca da Central. */
export function textoPuro(md: string, idioma: IdiomaDoSite = IDIOMA_PADRAO_DO_SITE): string {
  return filtrarPorAudiencia(md, "tudo", idioma)
    .replace(/[`*_>#|]/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export type Cabecalho = { titulo: string; resumo: string; categoria: string; ferramenta?: string; ordem: number };

/** Separa o cabeçalho `chave: valor` (entre `---`) do corpo. Falha alto se faltar campo. */
export function separarCabecalho(arquivo: string, origem: string): { cabecalho: Cabecalho; corpo: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(arquivo.replace(/\r\n/g, "\n"));
  if (!m) throw new Error(`${origem}: falta o cabeçalho entre ---`);
  const campos: Record<string, string> = {};
  for (const linha of m[1].split("\n")) {
    const i = linha.indexOf(":");
    if (i > 0) campos[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
  }
  for (const k of ["titulo", "resumo", "categoria", "ordem"]) {
    if (!campos[k]) throw new Error(`${origem}: falta "${k}" no cabeçalho`);
  }
  const ordem = Number(campos.ordem);
  if (!Number.isFinite(ordem)) throw new Error(`${origem}: "ordem" precisa ser número`);
  return {
    cabecalho: { titulo: campos.titulo, resumo: campos.resumo, categoria: campos.categoria, ferramenta: campos.ferramenta, ordem },
    corpo: m[2].trim(),
  };
}
