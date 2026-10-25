/**
 * O cadastro gratuito (17/10/2026): a lista de quem usa as ferramentas do site.
 *
 * Decisão do André: as ferramentas gratuitas (Kit, Cores, Grids) pedem o
 * cadastro na hora de BAIXAR ou EXPORTAR, e o pedido de convite do Fonts usa o
 * mesmo formulário. É um cadastro, NÃO uma conta de login: o login do produto é
 * de time e fechado desde 17/09/2026. As regras do banco estão em
 * `supabase/migrations/20261017153000_cadastros_gratuitos.sql`.
 *
 * Este arquivo é só o vocabulário e a validação, sem dependência de banco nem
 * de `@/`: roda no formulário e na rota, e a suíte de unidade o compila sozinho.
 */

export const ORIGENS = ["kit", "cores", "grids", "fonts", "tour"] as const;
export type Origem = (typeof ORIGENS)[number];

export const CARGOS = [
  { id: "diretor-de-arte", rotulo: "Diretor(a) de arte" },
  { id: "designer", rotulo: "Designer" },
  { id: "atendimento", rotulo: "Atendimento" },
  { id: "marketing", rotulo: "Marketing" },
  { id: "freelancer", rotulo: "Freelancer" },
  { id: "outro", rotulo: "Outro" },
] as const;

export const EQUIPES = [
  { id: "so-eu", rotulo: "Só eu" },
  { id: "2-5", rotulo: "2 a 5 pessoas" },
  { id: "6-15", rotulo: "6 a 15 pessoas" },
  { id: "16-50", rotulo: "16 a 50 pessoas" },
  { id: "mais-de-50", rotulo: "Mais de 50" },
] as const;

export const MARCAS = [
  { id: "1-3", rotulo: "1 a 3 marcas" },
  { id: "4-10", rotulo: "4 a 10 marcas" },
  { id: "11-30", rotulo: "11 a 30 marcas" },
  { id: "mais-de-30", rotulo: "Mais de 30" },
] as const;

export const COMO_CONHECEU = [
  { id: "indicacao", rotulo: "Indicação" },
  { id: "busca", rotulo: "Busca na internet" },
  { id: "instagram", rotulo: "Instagram" },
  { id: "linkedin", rotulo: "LinkedIn" },
  { id: "evento", rotulo: "Evento" },
  { id: "outro", rotulo: "Outro" },
] as const;

/** O pedido de convite do beta do Fonts: o computador e o tamanho da biblioteca de fontes. */
export const SISTEMAS = [
  { id: "mac-apple", rotulo: "Mac com chip Apple" },
  { id: "mac-intel", rotulo: "Mac com chip Intel" },
  { id: "windows", rotulo: "Windows" },
] as const;

export const BIBLIOTECAS = [
  { id: "ate-500", rotulo: "Até 500 fontes" },
  { id: "500-5000", rotulo: "De 500 a 5 mil" },
  { id: "mais-de-5000", rotulo: "Mais de 5 mil" },
  { id: "nao-sei", rotulo: "Não sei" },
] as const;

/**
 * O texto da caixa de marketing e a VERSÃO dele. O banco guarda a versão e a
 * data do aceite: mudou a frase, muda a versão — senão o registro deixa de
 * provar com quais palavras a pessoa concordou.
 */
/**
 * O texto da caixa de marketing e a VERSÃO dele, por idioma. A versão é a data em
 * que aquele texto passou a valer (o banco exige `AAAA-MM-DD`), e fica gravada
 * junto do aceite: quem marcou a caixa em inglês tem a versão do texto em inglês,
 * e a prova do que a pessoa leu não se confunde com o português. Mudou o texto de
 * um idioma, a versão dele muda.
 */
export const ACEITES = {
  "pt-BR": {
    versao: "2026-10-18",
    texto: "Quero receber e-mails do Brennimark com novidades e conteúdo para quem trabalha com marcas. Vamos pedir que você confirme por e-mail, e você pode sair a qualquer momento.",
  },
  en: {
    versao: "2026-10-25",
    texto: "I want to receive Brennimark emails with news and content for people who work with brands. We'll ask you to confirm by email, and you can unsubscribe at any time.",
  },
} as const;
export type IdiomaDoCadastro = keyof typeof ACEITES;
export const VERSAO_DO_ACEITE = ACEITES["pt-BR"].versao;
export const TEXTO_DO_ACEITE = ACEITES["pt-BR"].texto;

export function idiomaDoCadastro(valor: unknown): IdiomaDoCadastro {
  return valor === "en" ? "en" : "pt-BR";
}

/** O cookie que diz ao navegador que esta pessoa já se cadastrou (não é segredo). */
export const COOKIE_DO_CADASTRO = "bm_cadastro";

export type DadosDoCadastro = {
  email: string;
  nome: string;
  agencia: string | null;
  cargo: string | null;
  respostas: Record<string, string>;
  origem: Origem;
  aceiteMarketing: boolean;
  /** O idioma da tela em que a pessoa se cadastrou: define a versão do aceite e o idioma dos e-mails. */
  idioma: IdiomaDoCadastro;
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const ids = (lista: readonly { id: string }[]) => new Set(lista.map((i) => i.id));
const CARGOS_IDS = ids(CARGOS);
const EQUIPES_IDS = ids(EQUIPES);
const MARCAS_IDS = ids(MARCAS);
const CONHECEU_IDS = ids(COMO_CONHECEU);
const SISTEMAS_IDS = ids(SISTEMAS);
const BIBLIOTECAS_IDS = ids(BIBLIOTECAS);

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t.length > 0 && t.length <= max ? t : null;
}

export type ResultadoDaValidacao =
  | { ok: true; dados: DadosDoCadastro }
  | { ok: false; campo: string; mensagem: string };

/**
 * Confere o que veio do navegador. Nunca confia nele: o banco repete as
 * mesmas regras, e esta função existe para dizer à pessoa QUAL campo corrigir.
 */
export function validarCadastro(entrada: unknown): ResultadoDaValidacao {
  const c = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;

  const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) return { ok: false, campo: "email", mensagem: "Confira o e-mail." };

  const nome = texto(c.nome, 120);
  if (!nome) return { ok: false, campo: "nome", mensagem: "Diga o seu nome." };

  const origem = ORIGENS.find((o) => o === c.origem);
  if (!origem) return { ok: false, campo: "origem", mensagem: "Não foi possível identificar a ferramenta." };

  let agencia: string | null = null;
  if (c.agencia !== undefined && c.agencia !== null && c.agencia !== "") {
    agencia = texto(c.agencia, 120);
    if (!agencia) return { ok: false, campo: "agencia", mensagem: "O nome da agência ficou longo demais." };
  }

  let cargo: string | null = null;
  if (c.cargo !== undefined && c.cargo !== null && c.cargo !== "") {
    if (typeof c.cargo !== "string" || !CARGOS_IDS.has(c.cargo)) return { ok: false, campo: "cargo", mensagem: "Escolha um cargo da lista." };
    cargo = c.cargo;
  }

  const respostas: Record<string, string> = {};
  const r = (c.respostas && typeof c.respostas === "object" ? c.respostas : {}) as Record<string, unknown>;
  for (const [chave, permitidos] of [["equipe", EQUIPES_IDS], ["marcas", MARCAS_IDS], ["comoConheceu", CONHECEU_IDS], ["sistema", SISTEMAS_IDS], ["biblioteca", BIBLIOTECAS_IDS]] as const) {
    const v = r[chave];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string" || !permitidos.has(v)) return { ok: false, campo: chave, mensagem: "Escolha uma opção da lista." };
    respostas[chave] = v;
  }

  return { ok: true, dados: { email, nome, agencia, cargo, respostas, origem, aceiteMarketing: c.aceiteMarketing === true, idioma: idiomaDoCadastro(c.idioma) } };
}

/**
 * O pedido de convite do beta do Fonts (17/10/2026) fica marcado nas respostas
 * da própria linha do cadastro, sem coluna nova: `fontsBeta` diz que pediu, e
 * `fontsBetaEm` quando. É o que permite contar os 50 primeiros e ver a ordem do
 * pedido (`select … where respostas ? 'fontsBeta' order by respostas->>'fontsBetaEm'`).
 * Quem decide a marca é o servidor, nunca o navegador.
 */
export function comMarcaDoConvite(dados: DadosDoCadastro, agora: Date): DadosDoCadastro {
  if (dados.origem !== "fonts") return dados;
  return { ...dados, respostas: { ...dados.respostas, fontsBeta: "pedido", fontsBetaEm: agora.toISOString() } };
}

/**
 * O que `registrar_cadastro` devolve (18/10/2026): `{ confirmar, token }`. O
 * banco decide se é preciso mandar o e-mail de confirmação (caixa marcada, ainda
 * não confirmou, nenhum envio nas últimas 24 horas) e só entrega o token nesse
 * caso. Qualquer resposta fora dessa forma vale como "não enviar": errar para o
 * lado de não mandar e-mail é o lado seguro.
 */
export function lerRespostaDoRegistro(data: unknown): { confirmar: true; token: string } | { confirmar: false } {
  if (data && typeof data === "object") {
    const { confirmar, token } = data as { confirmar?: unknown; token?: unknown };
    if (confirmar === true && typeof token === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return { confirmar: true, token: token.toLowerCase() };
    }
  }
  return { confirmar: false };
}
