/**
 * Registros — a tela da CONTA que mostra o que já é gravado (28/09/2026).
 *
 * A especificação do Studio (§4.3) diz: "os dados já são gravados; falta a
 * tela". Decisões do André, 28/09:
 *   - Downloads: os de materiais e os do manual em PDF, juntos;
 *   - Acessos: as CONCESSÕES (quem deu, mudou ou tirou o acesso de quem). Quem
 *     ENTROU em qual marca não é gravado, e gravar seria vigilância de uso —
 *     fica para quando uma agência pedir, com decisão de LGPD;
 *   - Ações: o histórico do CONTEÚDO do manual (publicado, recuperado).
 *     Materiais e paleta ainda não guardam trilha de eventos;
 *   - Perguntas sem resposta: depois — as conversas são só de quem pergunta
 *     (decisão 72), e um relatório agregado pede regra de mínimo de pessoas.
 *
 * Quem vê o quê decide o BANCO: as tabelas de registro só entregam linhas das
 * marcas que a pessoa ADMINISTRA. A tela filtra; nunca autoriza.
 *
 * Tudo aqui é puro. Sem importação com `@/`: a suíte de unidade compila com
 * `tsconfig.tests.json`.
 */

export const ABAS = ["downloads", "acessos", "acoes", "perguntas"] as const;
export type Aba = (typeof ABAS)[number];

/** Linhas por página. O registro cresce a cada clique e nunca encolhe. */
export const LINHAS_POR_PAGINA = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export type Filtros = {
  aba: Aba;
  /** Uma marca, ou todas as que a pessoa administra. */
  marca: string | null;
  /** Trecho do e-mail ou do nome de quem fez (ou recebeu). */
  pessoa: string | null;
  /** Dia inicial e final, inclusive, como data do calendário (AAAA-MM-DD), no horário de Brasília. */
  de: string | null;
  ate: string | null;
  /** Cursor: só linhas ANTES deste instante (a última da página anterior). */
  antes: string | null;
};

/**
 * Os filtros de uma requisição, CONFERIDOS. O que não passa vira "sem filtro",
 * nunca erro: um filtro torto não pode derrubar a tela nem chegar ao banco.
 *
 * O trecho de pessoa vai a um `ilike` e a um `.or()` do PostgREST — vírgula,
 * parêntese e asterisco mudariam o sentido da consulta. Só passa o que um
 * e-mail tem.
 */
export function lerFiltros(params: URLSearchParams): Filtros {
  const aba = (ABAS as readonly string[]).includes(params.get("aba") ?? "") ? (params.get("aba") as Aba) : "downloads";
  const marca = UUID.test(params.get("marca") ?? "") ? params.get("marca")! : null;
  const pessoaBruta = (params.get("pessoa") ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  // Letras (com acento), números, espaço e . _ @ + - : um e-mail ou um nome
  // ("André Coelho" — o histórico de conteúdo guarda o nome, não o e-mail).
  const pessoa = /^[\p{L}\p{N} ._@+-]{1,80}$/u.test(pessoaBruta) ? pessoaBruta : null;
  const de = DATA.test(params.get("de") ?? "") ? params.get("de")! : null;
  const ate = DATA.test(params.get("ate") ?? "") ? params.get("ate")! : null;
  const antesBruto = params.get("antes") ?? "";
  const antes = !Number.isNaN(Date.parse(antesBruto)) && antesBruto.length <= 40 ? new Date(antesBruto).toISOString() : null;
  return { aba, marca, pessoa, de, ate, antes };
}

/**
 * O intervalo de tempo da consulta: de `de` 00:00 a `ate` 23:59:59.999 no
 * horário de Brasília (o produto é brasileiro; o banco guarda em UTC), e
 * nunca além do cursor.
 */
export function intervalo(f: Pick<Filtros, "de" | "ate" | "antes">): { desde: string | null; ate: string | null } {
  const desde = f.de ? new Date(`${f.de}T00:00:00-03:00`).toISOString() : null;
  const fimDoDia = f.ate ? new Date(new Date(`${f.ate}T00:00:00-03:00`).getTime() + 24 * 3600 * 1000).toISOString() : null;
  // O limite de cima é EXCLUSIVO: o menor entre o fim do dia e o cursor.
  const candidatos = [fimDoDia, f.antes].filter((v): v is string => v !== null);
  return { desde, ate: candidatos.length ? candidatos.sort()[0] : null };
}

// ─── As linhas ──────────────────────────────────────────────────────────────

export type LinhaDeDownload = {
  id: string;
  /** `link`: baixado por link de entrega (30/09/2026) — quem baixou se identificou sem conta. */
  tipo: "material" | "manual" | "link";
  /** Só em `link`: o nome do link por onde o arquivo saiu. */
  via?: string;
  marca: string;
  pessoa: string;
  /** O que foi baixado, como estava rotulado na hora. */
  oque: string;
  arquivo: string;
  quando: string;
};

export type LinhaDeAcesso = {
  id: string;
  marca: string;
  pessoa: string;
  autor: string;
  acao: "concedido" | "alterado" | "revogado";
  antes: string[];
  depois: string[];
  quando: string;
};

export type LinhaDeAcao = {
  id: string;
  marca: string;
  autor: string;
  acao: "published" | "restored_to_matrix";
  slug: string;
  titulo: string;
  quando: string;
};

/**
 * Downloads de materiais e do manual numa lista só, do mais recente para o
 * mais antigo, cortada em `limite`. Cada fonte já veio com até `limite` linhas
 * ANTES do cursor; juntas, as primeiras `limite` são a página certa.
 */
export function mesclarPorData<T extends { quando: string }>(listas: readonly (readonly T[])[], limite = LINHAS_POR_PAGINA): T[] {
  return listas.flat().sort((a, b) => (a.quando < b.quando ? 1 : a.quando > b.quando ? -1 : 0)).slice(0, limite);
}

/** O cursor da próxima página: o instante da última linha, se a página veio cheia. */
export function proximoCursor(linhas: readonly { quando: string }[], limite = LINHAS_POR_PAGINA): string | null {
  return linhas.length >= limite ? linhas[linhas.length - 1].quando : null;
}

const NOMES_DAS_CAPACIDADES: Record<string, [string, string]> = {
  consultar: ["consultar", "view"],
  editar: ["editar", "edit"],
  aprovar: ["aprovar", "approve"],
  administrar: ["administrar", "manage"],
};

/**
 * A mudança de acesso em uma frase curta: "consultar → consultar, editar",
 * "concedido: consultar", "revogado (tinha: editar)".
 */
export function descreverAcesso(linha: Pick<LinhaDeAcesso, "acao" | "antes" | "depois">, ingles = false): string {
  const nomes = (lista: readonly string[]) =>
    lista.length === 0 ? "—" : lista.map((c) => NOMES_DAS_CAPACIDADES[c]?.[ingles ? 1 : 0] ?? c).join(", ");
  if (linha.acao === "concedido") return `${ingles ? "granted" : "concedido"}: ${nomes(linha.depois)}`;
  if (linha.acao === "revogado") return `${ingles ? "revoked" : "revogado"} (${ingles ? "had" : "tinha"}: ${nomes(linha.antes)})`;
  return `${nomes(linha.antes)} → ${nomes(linha.depois)}`;
}

export function descreverAcao(acao: LinhaDeAcao["acao"], ingles = false): string {
  return acao === "published" ? (ingles ? "published" : "publicou") : (ingles ? "restored a version" : "recuperou uma versão");
}

/** Um instante em data e hora de Brasília, curto: "28/09 09:13". Ano só se não for o corrente. */
export function quandoCurto(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? "";
  const ano = p("year");
  const anoAtual = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(agora);
  return `${p("day")}/${p("month")}${ano !== anoAtual ? `/${ano}` : ""} ${p("hour")}:${p("minute")}`;
}
