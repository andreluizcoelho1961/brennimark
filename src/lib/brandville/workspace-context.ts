import { cache } from "react";
import { montarContexto, type WorkspaceContext } from "./context";
import { getBrandvilleAuthContext, getResolvedBrandDocs, resolveActiveBrand } from "./server";

export type { WorkspaceContext };

/**
 * Tudo que uma requisição precisa saber, resolvido uma vez.
 *
 * Antes cada página refazia a sequência por conta própria: autenticar,
 * escolher a marca, consultar documentos. O layout consultava e a página do
 * documento consultava de novo — mesma requisição, duas viagens ao banco, e
 * nenhuma garantia de que as duas tinham visto a mesma marca.
 *
 * Não é singleton. `cache` do React memoriza por requisição, não por processo:
 * num produto multiusuário e multimarca a marca ativa pertence à requisição,
 * jamais ao módulo importado. Um módulo com estado global de marca entregaria
 * a marca de uma conta para outra sob concorrência.
 */
export const resolveWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  const auth = await getBrandvilleAuthContext();
  if (!auth) return montarContexto({ auth: null, marca: null, docs: [] });

  const marca = await resolveActiveBrand(auth);
  const docs = marca ? await getResolvedBrandDocs(auth) : [];

  return montarContexto({
    auth: { role: auth.role, email: auth.user.email ?? undefined },
    marca,
    docs,
  });
});
