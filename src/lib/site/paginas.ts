/**
 * O mapa do site público — fonte única para o menu, as rotas e o `proxy`.
 *
 * Até 29/09/2026 o site era um protótipo num arquivo só, com as páginas
 * internas trocadas por script dentro de um endereço (`#pg-vini`). Agora cada
 * página tem o seu: é o que deixa o buscador encontrá-la e o link mandado a
 * alguém mostrar a página certa.
 *
 * O `proxy` deixa estes caminhos passarem sem sessão (ver
 * `caminhos-publicos.ts`), e por isso a lista é EXATA: `/vini` é do site,
 * `/vini/qualquer-coisa` não é. Página do site não lê dado nenhum — é HTML
 * gerado no deploy.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type GrupoDoMenu = "plataforma" | "para-quem" | "recursos" | "institucional";

export interface PaginaDoSite {
  /** O endereço, sem a barra: `vini` → `/vini`. */
  slug: string;
  /** Como a página se chama no menu e no título da aba. */
  titulo: string;
  /** A linha de apoio do menu do cabeçalho. */
  resumo: string;
  grupo: GrupoDoMenu;
}

export const PAGINAS_DO_SITE: readonly PaginaDoSite[] = [
  { slug: "manual", titulo: "O manual em PDF", resumo: "Fiel ao que o estúdio diagramou, com índice e busca", grupo: "plataforma" },
  { slug: "materiais", titulo: "Materiais da marca", resumo: "O kit inteiro num clique, com a regra junto", grupo: "plataforma" },
  { slug: "vini", titulo: "Vini Max", resumo: "Consulta, revisão de peça e prompts alinhados à marca", grupo: "plataforma" },
  { slug: "entrega", titulo: "Entrega e acesso", resumo: "Link com prazo e acesso por marca", grupo: "plataforma" },
  { slug: "complementos", titulo: "Complementos e lacunas", resumo: "O que o manual não diz, escrito e citado", grupo: "plataforma" },
  { slug: "studio", titulo: "Studio", resumo: "Onde a agência publica e cuida da marca", grupo: "plataforma" },
  { slug: "seguranca", titulo: "Segurança e privacidade", resumo: "Acesso por marca, conversas privadas, dados seus", grupo: "plataforma" },
  { slug: "agencias", titulo: "Agências e estúdios", resumo: "A marca entregue pronta para usar", grupo: "para-quem" },
  { slug: "empresas", titulo: "Empresas", resumo: "Fornecedores e equipes com a mesma referência", grupo: "para-quem" },
  { slug: "novidades", titulo: "Novidades", resumo: "O que entrou no produto", grupo: "recursos" },
  { slug: "ajuda", titulo: "Central de ajuda", resumo: "Guias e perguntas frequentes", grupo: "recursos" },
  { slug: "suporte", titulo: "Suporte", resumo: "Fale com a equipe sobre um problema", grupo: "recursos" },
  { slug: "manifesto", titulo: "Manifesto", resumo: "Por que a Brennimark existe", grupo: "recursos" },
  { slug: "termos", titulo: "Termos de uso", resumo: "As condições de uso da plataforma", grupo: "institucional" },
  { slug: "privacidade", titulo: "Privacidade", resumo: "Como os dados são tratados", grupo: "institucional" },
  { slug: "licenca-de-fontes", titulo: "Licença de fontes", resumo: "A fonte da marca e a licença dela", grupo: "institucional" },
];

export function paginasDoGrupo(grupo: GrupoDoMenu): PaginaDoSite[] {
  return PAGINAS_DO_SITE.filter((p) => p.grupo === grupo);
}

export function paginaDoSite(slug: string): PaginaDoSite {
  const pagina = PAGINAS_DO_SITE.find((p) => p.slug === slug);
  if (!pagina) throw new Error(`Página do site desconhecida: ${slug}`);
  return pagina;
}

/** Os caminhos EXATOS que o site ocupa: a home e cada página. */
export const CAMINHOS_DO_SITE: ReadonlySet<string> = new Set(["/", ...PAGINAS_DO_SITE.map((p) => `/${p.slug}`)]);

/** Os capítulos da home, na ordem do trilho. O `id` é a âncora (`/#planos`). */
export const CAPITULOS_DA_HOME = [
  { id: "inicio", titulo: "Início" },
  { id: "num-so-lugar", titulo: "Num só lugar" },
  { id: "problema", titulo: "O problema" },
  { id: "fluxo", titulo: "O dia a dia" },
  { id: "plataforma", titulo: "A plataforma" },
  { id: "vini", titulo: "Vini Max" },
  { id: "assistente", titulo: "Consultar" },
  { id: "analise", titulo: "Analisar" },
  { id: "dna", titulo: "Preparar" },
  { id: "viva", titulo: "Marca viva" },
  { id: "publico", titulo: "Para quem" },
  { id: "depoimentos", titulo: "Quem usa" },
  { id: "planos", titulo: "Planos" },
  { id: "demonstracao", titulo: "Demonstração" },
] as const;
