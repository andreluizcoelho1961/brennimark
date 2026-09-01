import { cache } from "react";
import { carregarWorkspaceContext, montarContexto, type WorkspaceContext } from "./context";
import { resolverAlvo, resolverSemAlvo, type Alvo } from "./selecao";
import {
  carregarMarca,
  getBrandDocs,
  getBrandvilleAuthContext,
  getProfileSummary,
  listarDisponiveis,
  temPerfilCompleto,
  temSessao,
  type BrandvilleAuthContext,
} from "./server";

export type { WorkspaceContext };

const SKIP_AUTH = process.env.BRANDVILLE_DEV_SKIP_AUTH === "true";

/**
 * O adaptador entre a regra e o banco.
 *
 * `cache` do React memoriza por requisição, não por processo. A diferença é a
 * razão de existir deste módulo: num produto multiusuário e multimarca, um
 * objeto global de marca entrega a marca de uma conta para outra sob
 * concorrência — defeito que só aparece com duas contas simultâneas, ou seja,
 * nunca em desenvolvimento.
 *
 * O alvo vem da URL. Quando ele não vem — rotas que ainda não o carregam —, a
 * resolução acontece se, e somente se, houver uma possibilidade só. Havendo
 * mais de uma, o resultado é `ambiguous` e quem chamou tem de perguntar. Em
 * nenhum caminho existe "a primeira": ou é a única, ou é a pedida, ou é uma
 * pergunta.
 *
 * Todo consumidor da requisição — layout, navegação, página, canvas, rotas de
 * IA — chama esta função e recebe o mesmo objeto para o mesmo alvo.
 */
export const resolveWorkspaceContext = cache(
  async (alvo?: Alvo): Promise<WorkspaceContext> => {
    if (SKIP_AUTH) {
      return carregarWorkspaceContext<BrandvilleAuthContext & { role: "owner" | "member" }>({
        temSessao, getAuth: async () => null, getProfile: getProfileSummary,
        getActiveBrand: async () => null, getDocsByBrandId: getBrandDocs, devPreview: true,
      });
    }

    const disponiveis = await listarDisponiveis();
    if (disponiveis === null) {
      // Sem sessão. A pergunta sobre cadastro nem chega a ser feita.
      return montarContexto({ access: "anonymous", auth: null, marca: null, docs: [] });
    }

    // Cadastro completo exige as duas coisas que o onboarding produz: nome no
    // perfil E workspace. Faltando qualquer uma, a pessoa vai para o cadastro —
    // e não para um 404 que a deixaria sem saída.
    const estado = {
      temSessao: true,
      cadastroCompleto: (await temPerfilCompleto()) && disponiveis.length > 0,
      disponiveis,
    };

    const decisao = alvo ? resolverAlvo(estado, alvo) : resolverSemAlvo(estado);

    switch (decisao.tipo) {
      case "anonimo":
        return montarContexto({ access: "anonymous", auth: null, marca: null, docs: [] });
      case "onboarding":
        return montarContexto({ access: "onboarding", auth: null, marca: null, docs: [] });
      case "nao-encontrado":
        return montarContexto({ access: "not-found", auth: null, marca: null, docs: [] });
      case "sem-marca":
        // Conta existe, marca não. Não é 404 nem escolha: é a importação.
        return montarContexto({
          access: "ambiguous", auth: null, marca: null, docs: [],
          workspaceSlug: decisao.workspaceSlug, opcoes: disponiveis,
        });
      case "escolher":
        return montarContexto({
          access: "ambiguous", auth: null, marca: null, docs: [], opcoes: decisao.opcoes,
        });
      case "ir-para":
        // Uma possibilidade só: resolve o par que ela mesma indica, em vez de
        // devolver "vá para lá" e resolver de novo do outro lado.
        return carregarPronto(decisao.destino);
      case "pronto":
        return carregarPronto({
          workspaceSlug: decisao.workspace.slug,
          brandKey: decisao.marca.key,
        }, decisao.marca.id);
    }
  },
);

async function carregarPronto(alvo: Alvo, brandId?: string): Promise<WorkspaceContext> {
  return carregarWorkspaceContext<BrandvilleAuthContext & { role: "owner" | "member"; email?: string }>({
    temSessao,
    workspaceSlug: alvo.workspaceSlug,
    getAuth: async () => {
      const auth = await getBrandvilleAuthContext(alvo.workspaceSlug);
      return auth ? { ...auth, email: auth.user.email ?? undefined } : null;
    },
    getProfile: getProfileSummary,
    getActiveBrand: async (auth) => {
      if (brandId) return carregarMarca(auth, brandId);
      const encontrada = (await listarDisponiveis())
        ?.find((w) => w.slug === alvo.workspaceSlug)
        ?.marcas.find((m) => m.key === alvo.brandKey);
      return encontrada ? carregarMarca(auth, encontrada.id) : null;
    },
    getDocsByBrandId: getBrandDocs,
  });
}
