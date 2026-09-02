import { NextResponse } from "next/server";
import { resolveWorkspaceContext, type WorkspaceContext } from "./workspace-context";
import type { Alvo } from "./selecao";
import { podeUsar, type Utilidade } from "../ai/permissao";
import { getBrandvilleAuthContext, resolverWorkspaceAtivo, type BrandvilleAuthContext } from "./server";

/**
 * O workspace de uma rota de API, ou uma resposta que explica por que não há um.
 *
 * As rotas recebem o alvo por `?w=<slug>` — a mesma escolha que a URL da
 * interface carrega. Sem o parâmetro, resolve se houver uma conta só.
 *
 * A razão de existir: antes, "não autenticado" e "você tem duas contas e não
 * disse qual" produziam a mesma resposta 401. A primeira é verdade; a segunda é
 * mentira, e manda a pessoa entrar de novo numa sessão que já está válida.
 * Ambiguidade agora é 409 e vem com as opções, para o cliente poder perguntar.
 */
export type ContextoDaRota =
  | { ok: true; workspaceId: string; workspaceSlug: string; papel: "owner" | "member" }
  | { ok: false; resposta: NextResponse };

export async function workspaceDaRota(request: Request): Promise<ContextoDaRota> {
  const slug = new URL(request.url).searchParams.get("w") ?? undefined;
  const r = await resolverWorkspaceAtivo(slug);

  if (r.tipo === "workspace") {
    return {
      ok: true,
      workspaceId: r.workspace.id,
      workspaceSlug: r.workspace.slug,
      papel: r.workspace.papel,
    };
  }

  if (r.tipo === "nao-encontrado") {
    // Mesma resposta para "não existe" e "você não participa": responder
    // diferente confirmaria o endereço para quem está sondando.
    return { ok: false, resposta: NextResponse.json({ error: "nao_encontrado" }, { status: 404 }) };
  }

  if (r.tipo === "escolher" && r.opcoes.length > 0) {
    return {
      ok: false,
      resposta: NextResponse.json(
        {
          error: "workspace_ambiguo",
          detalhe: "Mais de uma conta alcançável. Informe ?w=<slug>.",
          opcoes: r.opcoes.map((w) => ({ slug: w.slug, nome: w.nome })),
        },
        { status: 409 },
      ),
    };
  }

  // Sem sessão, ou sessão sem conta: as duas pedem autenticação/cadastro, e
  // nenhuma é ambiguidade.
  return { ok: false, resposta: NextResponse.json({ error: "not_authenticated" }, { status: 401 }) };
}

/**
 * O contexto autenticado de uma rota, com o mesmo tratamento de ambiguidade.
 *
 * Existe para as rotas que precisam do cliente Supabase e do usuário, não só do
 * identificador do workspace. A resolução é a mesma, e portanto a resposta
 * também: 409 quando há mais de uma conta e nenhuma foi indicada.
 */
export type AutenticacaoDaRota =
  | { ok: true; contexto: BrandvilleAuthContext }
  | { ok: false; resposta: NextResponse };

export async function autenticacaoDaRota(request: Request): Promise<AutenticacaoDaRota> {
  const workspace = await workspaceDaRota(request);
  if (!workspace.ok) return { ok: false, resposta: workspace.resposta };

  const contexto = await getBrandvilleAuthContext(workspace.workspaceSlug);
  if (!contexto) {
    return { ok: false, resposta: NextResponse.json({ error: "not_authenticated" }, { status: 401 }) };
  }
  return { ok: true, contexto };
}

/**
 * O alvo que a rota carrega: `?w=<slug>&b=<chave>`.
 *
 * Os dois ou nenhum. Meio alvo — só a conta, ou só a marca — seria uma escolha
 * pela metade, e a metade que falta voltaria a ser preenchida por palpite.
 */
export function alvoDaRota(request: Request): Alvo | undefined {
  const params = new URL(request.url).searchParams;
  const workspaceSlug = params.get("w");
  const brandKey = params.get("b");
  return workspaceSlug && brandKey ? { workspaceSlug, brandKey } : undefined;
}

/**
 * Contexto completo — marca resolvida e autenticação — para rotas de conteúdo.
 *
 * Traduz cada estado da resolução na resposta que o corresponde, em vez de
 * reduzir todos a `null`. O 409 é o que mudou de fundo: uma conta com duas
 * marcas recebia 401 e era mandada a entrar de novo numa sessão válida.
 */
export type ConteudoDaRota =
  | { ok: true; contexto: WorkspaceContext; auth: BrandvilleAuthContext }
  | { ok: false; resposta: NextResponse };

export async function conteudoDaRota(request: Request): Promise<ConteudoDaRota> {
  const alvo = alvoDaRota(request);
  const contexto = await resolveWorkspaceContext(alvo);

  if (contexto.access === "not-found") {
    return { ok: false, resposta: NextResponse.json({ error: "nao_encontrado" }, { status: 404 }) };
  }
  if (contexto.access === "ambiguous") {
    return {
      ok: false,
      resposta: NextResponse.json(
        {
          error: contexto.opcoes.some((w) => w.marcas.length > 0) ? "marca_ambigua" : "sem_marca",
          detalhe: "Informe ?w=<conta>&b=<marca>.",
          opcoes: contexto.opcoes.flatMap((w) =>
            w.marcas.map((m) => ({ w: w.slug, b: m.key, nome: `${w.nome} · ${m.nome}` })),
          ),
        },
        { status: 409 },
      ),
    };
  }
  if (contexto.access !== "ready") {
    return { ok: false, resposta: NextResponse.json({ error: "not_authenticated" }, { status: 401 }) };
  }

  const auth = await getBrandvilleAuthContext(contexto.workspaceSlug ?? undefined);
  if (!auth) {
    return { ok: false, resposta: NextResponse.json({ error: "not_authenticated" }, { status: 401 }) };
  }
  return { ok: true, contexto, auth };
}

/**
 * Conta e marca resolvidas, para rotas que gravam ou leem conteúdo da marca.
 *
 * Devolve os dois identificadores IMUTÁVEIS. É de propósito que a chave e o
 * slug não venham juntos: eles são editáveis, e qualquer coisa gravada a
 * partir deles — caminho de Storage, filtro de consulta — passa a mentir no
 * dia em que alguém renomeia a marca.
 */
export type MarcaDaRota =
  | {
      ok: true;
      workspaceId: string;
      brandId: string;
      brand: NonNullable<WorkspaceContext["brand"]>;
      auth: BrandvilleAuthContext;
      papel: "owner" | "member";
    }
  | { ok: false; resposta: NextResponse };

export async function marcaDaRota(request: Request): Promise<MarcaDaRota> {
  const resolvido = await conteudoDaRota(request);
  if (!resolvido.ok) return resolvido;

  const { contexto, auth } = resolvido;
  if (!contexto.brand) {
    // `ready` sem marca não deveria acontecer — a resolução só chega a `ready`
    // com marca. Se acontecer, é defeito, e responder 409 é mais honesto que
    // seguir com `brand_id` indefinido e gravar linha órfã.
    return {
      ok: false,
      resposta: NextResponse.json({ error: "sem_marca" }, { status: 409 }),
    };
  }

  return {
    ok: true,
    workspaceId: auth.workspaceId,
    brandId: contexto.brand.id,
    brand: contexto.brand,
    auth,
    papel: auth.role,
  };
}

/**
 * O portão das rotas de IA.
 *
 * Resolve a marca e aplica a matriz do G1 no SERVIDOR. A navegação já filtra
 * destinos por capacidade, mas isso decide o que aparece — nunca decidiu o que
 * é permitido, e quem souber a URL da API chega nela do mesmo jeito.
 *
 * As duas recusas respondem diferente de propósito:
 *
 *   404  a marca não contratou esta funcionalidade. Ela não existe aqui, e
 *        dizer "não existe" é a verdade.
 *   403  existe, e este papel não a usa.
 */
export type PortaoDeIA =
  | {
      ok: true;
      contexto: WorkspaceContext;
      auth: BrandvilleAuthContext;
      brand: NonNullable<WorkspaceContext["brand"]>;
    }
  | { ok: false; resposta: NextResponse };

export async function portaoDeIA(
  request: Request,
  utilidade: Utilidade,
): Promise<PortaoDeIA> {
  const resolvido = await conteudoDaRota(request);
  if (!resolvido.ok) return resolvido;

  const { contexto, auth } = resolvido;
  if (!contexto.brand) {
    return { ok: false, resposta: NextResponse.json({ error: "no_brand" }, { status: 409 }) };
  }

  const veredito = podeUsar({
    utilidade,
    capabilities: contexto.capabilities,
    utilityLinks: contexto.brand.navigation.utilityLinks,
  });

  if (!veredito.permitido) {
    return veredito.motivo === "nao-contratada"
      ? {
          ok: false,
          resposta: NextResponse.json({ error: "utilidade_nao_contratada" }, { status: 404 }),
        }
      : {
          ok: false,
          resposta: NextResponse.json({ error: "sem_permissao" }, { status: 403 }),
        };
  }

  return { ok: true, contexto, auth, brand: contexto.brand };
}

/**
 * As rotas que governam a conta: chaves e roteamento de IA.
 *
 * A RLS já recusa a escrita de quem não administra, mas ela recusa em
 * SILÊNCIO — um update sem linhas afetadas parece sucesso, e a tela diria
 * "salvo" sobre algo que não foi salvo. A recusa explícita aqui é o que
 * transforma isso em 403.
 *
 * As duas camadas existem de propósito: a rota é a que responde bem, e a RLS é
 * a que continua valendo se alguém chegar pela Data API sem passar por rota
 * nenhuma.
 */
export async function donoDaRota(request: Request): Promise<ContextoDaRota> {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r;
  if (r.papel !== "owner") {
    return {
      ok: false,
      resposta: NextResponse.json({ error: "sem_permissao" }, { status: 403 }),
    };
  }
  return r;
}
