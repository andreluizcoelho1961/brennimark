import { cache } from "react";
import { carregarWorkspaceContext, type WorkspaceContext } from "./context";
import {
  getBrandDocs,
  getBrandvilleAuthContext,
  getProfileSummary,
  resolveActiveBrand,
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
 * Todo consumidor da requisição — layout, navegação, página, canvas, rotas de
 * IA — chama esta função e recebe o mesmo objeto. A sequência que ela dispara
 * está em context.ts e é contada por teste.
 */
export const resolveWorkspaceContext = cache(
  async (): Promise<WorkspaceContext> =>
    carregarWorkspaceContext<BrandvilleAuthContext & { role: "owner" | "member"; email?: string }>({
      temSessao,
      getAuth: async () => {
        const auth = await getBrandvilleAuthContext();
        return auth ? { ...auth, email: auth.user.email ?? undefined } : null;
      },
      getProfile: getProfileSummary,
      getActiveBrand: resolveActiveBrand,
      getDocsByBrandId: getBrandDocs,
      devPreview: SKIP_AUTH,
    }),
);
