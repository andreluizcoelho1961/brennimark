import { notFound } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brennimark/workspace-context";
import { podeUsar } from "@/lib/ai/permissao";

/**
 * A porta desta utilidade, no SERVIDOR.
 *
 * O G1 fechou as ROTAS DE API por `utilityLinks`; as PÁGINAS continuaram
 * abertas. Quem digitasse o endereço via a tela montada — com campo, botão e
 * histórico vazio — de uma funcionalidade que a marca não contratou. A recusa
 * chegava só quando a API respondia, e uma tela que existe promete uma coisa
 * que o servidor vai negar.
 *
 * 404 e não 403: a funcionalidade não existe NESTA marca, e dizer isso é a
 * verdade. Responder 403 revelaria a diferença entre "não contratada" e "não
 * é para o seu papel", que é justamente o que a matriz do G1 evita.
 *
 * `layout` e não `page`: ele cobre a rota e tudo abaixo dela, então uma
 * subpágina nova nasce fechada em vez de nascer esquecida.
 */
export default async function Porta({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string; brandKey: string }>;
}) {
  const alvo = await params;
  const { capabilities, brand } = await resolveWorkspaceContext(alvo);

  const veredito = podeUsar({
    utilidade: "analysis",
    capabilities,
    utilityLinks: brand?.navigation.utilityLinks,
  });
  if (!veredito.permitido) notFound();

  return <>{children}</>;
}
