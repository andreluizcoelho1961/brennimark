/**
 * Os idiomas do site público — fatia 5 (24/10/2026).
 *
 * O primeiro é o padrão e NÃO leva prefixo no endereço: `/vini` é português,
 * como sempre foi. Os demais levam o código: `/en/vini`. O `proxy` reescreve o
 * endereço sem prefixo para `/pt-BR/...` por dentro (a pessoa nunca vê isso).
 *
 * Existe UMA árvore de páginas (`app/[lang]`), com os nomes de pasta em
 * português. O endereço em inglês é traduzido (`/en/agencies`) e o `proxy` o
 * reescreve para a pasta (`/en/agencias`) por dentro. Um idioma novo entra
 * aqui, em `SEGMENTOS` e nos catálogos; não precisa de pasta nova.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const IDIOMAS_DO_SITE = ["pt-BR", "en"] as const;

export type IdiomaDoSite = (typeof IDIOMAS_DO_SITE)[number];

export const IDIOMA_PADRAO_DO_SITE: IdiomaDoSite = "pt-BR";

/** O que vai no endereço para quem NÃO é o padrão. */
export const PREFIXOS_DE_IDIOMA = ["en"] as const;

export function idiomaDoSiteValido(valor: string): valor is IdiomaDoSite {
  return (IDIOMAS_DO_SITE as readonly string[]).includes(valor);
}

/**
 * Cada segmento de endereço do site, no idioma de cada língua. A chave é o
 * nome da pasta (português). Segmento fora do mapa — o código de um artigo, por
 * exemplo — vale igual nos dois idiomas.
 */
const SEGMENTOS: Record<Exclude<IdiomaDoSite, "pt-BR">, Record<string, string>> = {
  en: {
    manual: "manual",
    materiais: "materials",
    vini: "vini",
    fonts: "fonts",
    seguranca: "security",
    agencias: "agencies",
    empresas: "companies",
    ajuda: "help",
    manifesto: "manifesto",
    termos: "terms",
    privacidade: "privacy",
    "licenca-de-fontes": "font-license",
    ferramentas: "tools",
    janela: "window",
    cores: "colors",
    categoria: "category",
  },
};

/**
 * As páginas que JÁ têm versão em cada idioma, pelo nome da pasta. O português
 * tem todas. Uma página de outro idioma que não está aqui NÃO abre: o `proxy`
 * leva para a equivalente em português, com um aviso, em vez de mostrar texto
 * misturado ou um 404. Entra aqui quando o conteúdo estiver traduzido.
 */
export const PAGINAS_TRADUZIDAS: Record<IdiomaDoSite, ReadonlySet<string> | "todas"> = {
  "pt-BR": "todas",
  en: new Set<string>(["", "manifesto", "agencias", "empresas", "licenca-de-fontes", "manual", "materiais", "vini", "seguranca", "termos", "privacidade", "fonts", "ajuda"]),
};

/** O parâmetro que avisa, na página em português, que a pedida ainda não existe no outro idioma. */
export const PARAMETRO_DE_AVISO = "idioma";
export const VALOR_DE_AVISO = "indisponivel";

function separar(caminho: string): { corpo: string; resto: string } {
  const i = caminho.search(/[?#]/);
  return i === -1 ? { corpo: caminho, resto: "" } : { corpo: caminho.slice(0, i), resto: caminho.slice(i) };
}

/** O endereço (em português, sem prefixo) no idioma pedido. Âncora e query ficam como vieram. */
export function caminhoDoSite(idioma: IdiomaDoSite, caminhoPt: string): string {
  if (idioma === "pt-BR") return caminhoPt;
  const { corpo, resto } = separar(caminhoPt);
  const mapa = SEGMENTOS[idioma];
  const segmentos = corpo.split("/").filter(Boolean).map((s) => mapa[s] ?? s);
  return `/${idioma}${segmentos.length ? `/${segmentos.join("/")}` : ""}${resto}`;
}

/**
 * O endereço em português (sem prefixo) de um endereço de outro idioma, ou
 * `null` se o primeiro segmento não pertence ao idioma — `/en/agencias` não é
 * inglês, é português com prefixo, e o `proxy` o manda para `/en/agencies`.
 */
export function caminhoPtDeOutroIdioma(idioma: Exclude<IdiomaDoSite, "pt-BR">, caminho: string): string | null {
  const { corpo } = separar(caminho);
  const mapa = SEGMENTOS[idioma];
  const inverso = new Map(Object.entries(mapa).map(([pt, traduzido]) => [traduzido, pt]));
  const segmentos = corpo.split("/").filter(Boolean);
  if (segmentos.length === 0) return "/";
  const primeiro = inverso.get(segmentos[0]);
  if (!primeiro) return null;
  const pt = [primeiro, ...segmentos.slice(1).map((s) => inverso.get(s) ?? s)];
  return `/${pt.join("/")}`;
}

/** A página (pasta de primeiro nível, ou "" para a home) já tem versão neste idioma? */
export function paginaTraduzida(idioma: IdiomaDoSite, caminhoPt: string): boolean {
  const permitidas = PAGINAS_TRADUZIDAS[idioma];
  if (permitidas === "todas") return true;
  const primeiro = caminhoPt.split("/").filter(Boolean)[0] ?? "";
  return permitidas.has(primeiro);
}

/** O mesmo endereço no outro idioma, para o botão de idioma do cabeçalho. */
export function caminhoNoOutroIdioma(atual: string, destino: IdiomaDoSite): string {
  const { corpo, resto } = separar(atual);
  const ehEn = corpo === "/en" || corpo.startsWith("/en/");
  const pt = ehEn ? (caminhoPtDeOutroIdioma("en", corpo.slice(3) || "/") ?? "/") : corpo;
  return `${caminhoDoSite(destino, pt)}${resto}`;
}
