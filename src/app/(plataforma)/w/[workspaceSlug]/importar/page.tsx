import { redirect } from "next/navigation";
import { getBrennimarkAuthContext } from "@/lib/brennimark/server";
import { resolveWorkspaceContext } from "@/lib/brennimark/workspace-context";
import { BrandImporter } from "@/components/import/BrandImporter";
import { capabilitiesForRole } from "@/platform/capabilities";
import { MolduraDaConta } from "@/components/shell/MolduraDaConta";

/**
 * A porta de entrada do produto.
 *
 * Vive em /w/<conta>/importar, FORA do contexto de marca, porque importar é o
 * ato que cria a marca: exigir `brandKey` na URL para chegar aqui tornaria a
 * primeira importação de uma conta inalcançável — a marca que a URL pediria é
 * exatamente a que ainda não existe.
 *
 * Interface autenticada e exclusiva de quem administra — não um script com
 * chave de serviço. Quem importa é o autor do conteúdo importado, e é a sessão
 * dessa pessoa que atravessa o Storage e a RPC. A chave privilegiada do
 * Supabase não participa deste caminho em nenhum ponto.
 */
export default async function ImportarPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const [contexto, auth] = await Promise.all([
    resolveWorkspaceContext(),
    getBrennimarkAuthContext(workspaceSlug),
  ]);

  if (contexto.access === "anonymous") redirect("/login");
  if (contexto.access === "onboarding") redirect("/onboarding");

  // A capacidade vem do papel NO WORKSPACE, não do contexto de marca: esta
  // tela existe justamente quando pode não haver marca, e `contexto.
  // capabilities` seria vazio — trancando quem tem todo direito de entrar.
  // O vocabulário de autorização continua sendo o mesmo do resto do produto.
  const capabilities = capabilitiesForRole(auth?.role);
  if (!auth || !capabilities.includes("administrar")) redirect("/docs");

  // Dentro da moldura desde 18/09: importar é um gesto da tela Marcas, e não
  // uma página solta sem caminho de volta.
  return (
    <MolduraDaConta contexto={contexto} contaSlug={workspaceSlug}>
      <BrandImporter workspaceId={auth.workspaceId} workspaceSlug={auth.workspaceSlug} />
    </MolduraDaConta>
  );
}
