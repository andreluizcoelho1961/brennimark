/**
 * Qual workspace e qual marca esta requisição está vendo.
 *
 * Módulo puro: sem Supabase, sem React, sem `process.env`. A decisão de
 * contexto ativo é a regra mais fácil de errar do produto inteiro — errar aqui
 * mostra a marca de um cliente para outro — e uma regra que só pode ser
 * observada rodando a aplicação inteira não é observável.
 *
 * O contexto ativo vem da URL. Não de variável de ambiente (exige rebuild para
 * trocar de marca, e amarra um processo a um cliente), não de "a primeira linha
 * criada" (silenciosa e arbitrária), não de estado global de módulo (vaza entre
 * requisições concorrentes). A URL é endereçável, compartilhável, e duas abas
 * podem mostrar marcas diferentes ao mesmo tempo sem uma sobrescrever a outra.
 */

export interface Alvo {
  workspaceSlug: string;
  brandKey: string;
}

/** O que a pessoa tem acesso, já filtrado pelo banco por associação. */
export interface WorkspaceDisponivel {
  id: string;
  slug: string;
  nome: string;
  papel: "owner" | "member";
  marcas: readonly MarcaDisponivel[];
}

export interface MarcaDisponivel {
  id: string;
  key: string;
  nome: string;
}

export type Resolucao =
  /** Sem sessão. Vai para o login. */
  | { tipo: "anonimo" }
  /** Tem sessão, falta conta ou perfil. Vai para o cadastro. */
  | { tipo: "onboarding" }
  /**
   * O alvo pedido não serve. Um único resultado para três causas — slug que
   * não existe, workspace do qual a pessoa não participa, marca que não
   * pertence àquele workspace — e isso é deliberado: responder "existe, mas
   * você não participa" confirma para quem está sondando que o endereço é
   * real. As três viram 404.
   */
  | { tipo: "nao-encontrado" }
  /** Nenhuma marca em lugar nenhum. A saída é importar a primeira. */
  | { tipo: "sem-marca"; workspaceSlug: string | null }
  /** Exatamente uma opção. Não há o que perguntar: vai direto. */
  | { tipo: "ir-para"; destino: Alvo }
  /**
   * Mais de uma. PERGUNTA, em vez de escolher. Escolher "a primeira" aqui é
   * exatamente o defeito que o M1 corrige: silencioso, arbitrário, e
   * indistinguível de estar certo até o dia em que está errado.
   */
  | { tipo: "escolher"; opcoes: readonly WorkspaceDisponivel[] }
  /** O alvo é válido e a pessoa participa. */
  | { tipo: "pronto"; workspace: WorkspaceDisponivel; marca: MarcaDisponivel };

export interface EstadoDaPessoa {
  temSessao: boolean;
  /** Falso quando há sessão mas falta workspace ou nome no perfil. */
  cadastroCompleto: boolean;
  /** Já filtrados por associação. Uma lista vazia significa nenhum acesso. */
  disponiveis: readonly WorkspaceDisponivel[];
}

/**
 * O alvo pedido na URL é válido para esta pessoa?
 *
 * Procura na lista que o banco já filtrou por associação, em vez de consultar
 * de novo: a validação de participação e a resolução do conteúdo têm de olhar
 * a mesma coisa. Duas consultas separadas são duas chances de divergir, e a
 * divergência aqui é conteúdo de um cliente sob a URL de outro.
 */
export function resolverAlvo(estado: EstadoDaPessoa, alvo: Alvo): Resolucao {
  if (!estado.temSessao) return { tipo: "anonimo" };
  if (!estado.cadastroCompleto) return { tipo: "onboarding" };

  const workspace = estado.disponiveis.find((w) => w.slug === alvo.workspaceSlug);
  if (!workspace) return { tipo: "nao-encontrado" };

  const marca = workspace.marcas.find((m) => m.key === alvo.brandKey);
  if (!marca) return { tipo: "nao-encontrado" };

  return { tipo: "pronto", workspace, marca };
}

/**
 * Sem alvo na URL: para onde mandar a pessoa.
 *
 * Uma opção redireciona; várias perguntam; nenhuma leva à importação. O caso
 * de várias é o que separa este produto do anterior — e é justamente o que
 * `.limit(1)` escondia.
 */
export function resolverSemAlvo(estado: EstadoDaPessoa): Resolucao {
  if (!estado.temSessao) return { tipo: "anonimo" };
  if (!estado.cadastroCompleto) return { tipo: "onboarding" };

  const pares = estado.disponiveis.flatMap((workspace) =>
    workspace.marcas.map((marca) => ({ workspace, marca })),
  );

  if (pares.length === 0) {
    // Distingue "conta sem marca" de "sem conta": a primeira tem para onde
    // importar; a segunda ainda precisa de cadastro.
    return { tipo: "sem-marca", workspaceSlug: estado.disponiveis[0]?.slug ?? null };
  }

  /*
   * A tela inicial aparece SEMPRE, mesmo com uma marca só.
   *
   * Decisão do André em 12/09/2026. Antes, uma marca só dispensava a pergunta e
   * o login caía direto dentro dela — e, desde o ADR-0006, direto no PDF. O
   * produto passava a existir sem porta: nenhuma tela dizia o que a plataforma
   * é, e a conta com uma marca nunca via a lista das suas marcas.
   *
   * O custo é um clique a mais para quem tem uma marca. O que se ganha é um
   * lugar onde a pessoa chega, entende onde está e escolhe — e onde cabem, no
   * futuro, os cards de todas as marcas da conta.
   *
   * `resolverAlvo` não muda: quem chega com endereço de marca continua indo
   * direto para ela, e é isso que mantém o link compartilhado valendo.
   */
  return { tipo: "escolher", opcoes: estado.disponiveis };
}

/** O endereço canônico de uma marca. Um lugar só monta URL de contexto. */
export function caminhoDaMarca(alvo: Alvo, resto = ""): string {
  const sufixo = resto.replace(/^\/+/, "");
  const base = `/w/${encodeURIComponent(alvo.workspaceSlug)}/b/${encodeURIComponent(alvo.brandKey)}`;
  return sufixo ? `${base}/${sufixo}` : `${base}/docs`;
}

/**
 * Só o workspace, sem exigir marca.
 *
 * Existe porque nem todo caminho precisa de marca: importar a PRIMEIRA marca
 * de uma conta acontece necessariamente antes de existir marca nenhuma. Exigir
 * "pronto" ali fecharia a única porta de entrada do produto.
 *
 * A regra é a mesma: um workspace resolve sozinho; vários perguntam. "Um" não
 * é "o primeiro de vários" — é o único que existe.
 */
export type ResolucaoDeWorkspace =
  | { tipo: "anonimo" }
  | { tipo: "onboarding" }
  | { tipo: "nao-encontrado" }
  | { tipo: "escolher"; opcoes: readonly WorkspaceDisponivel[] }
  | { tipo: "workspace"; workspace: WorkspaceDisponivel };

export function resolverWorkspace(
  estado: EstadoDaPessoa,
  workspaceSlug?: string,
): ResolucaoDeWorkspace {
  if (!estado.temSessao) return { tipo: "anonimo" };
  if (!estado.cadastroCompleto) return { tipo: "onboarding" };

  if (workspaceSlug !== undefined) {
    const alvo = estado.disponiveis.find((w) => w.slug === workspaceSlug);
    return alvo ? { tipo: "workspace", workspace: alvo } : { tipo: "nao-encontrado" };
  }

  if (estado.disponiveis.length === 1) {
    return { tipo: "workspace", workspace: estado.disponiveis[0] };
  }
  // Zero também cai aqui: sem conta, não há workspace a oferecer, e a lista
  // vazia diz isso sem fingir um destino.
  return { tipo: "escolher", opcoes: estado.disponiveis };
}

/**
 * Para onde vai quem troca de marca.
 *
 * Sempre a visão geral da marca de destino — nunca o caminho em que a pessoa
 * estava. Levar `/docs/cor` junto parece conveniente e é uma armadilha: a
 * marca B pode não ter uma página `cor`, e as três saídas de "carregar mesmo
 * assim" são todas erradas. Mostrar a página de A sob o nome de B é vazamento
 * entre clientes. Inferir uma página equivalente é inventar conteúdo. Cair num
 * 404 logo depois de clicar no nome de uma marca faz a troca parecer quebrada.
 *
 * A visão geral existe sempre e é o único destino que não depende do que a
 * marca de destino contém.
 */
export function destinoAoTrocarDeMarca(destino: Alvo): string {
  return caminhoDaMarca(destino);
}
