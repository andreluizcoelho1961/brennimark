import { redirect } from "next/navigation";
import { getBrandvilleAuthContext } from "@/lib/brandville/server";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { BrandImporter } from "@/components/import/BrandImporter";

/**
 * A porta de entrada do produto.
 *
 * Interface autenticada e exclusiva de quem administra — não um script com
 * chave de serviço. Quem importa é o autor do conteúdo importado, e é a sessão
 * dessa pessoa que atravessa o Storage e a RPC. A chave privilegiada do
 * Supabase não participa deste caminho em nenhum ponto.
 */
export default async function ImportarPage() {
  const [contexto, auth] = await Promise.all([
    resolveWorkspaceContext(),
    getBrandvilleAuthContext(),
  ]);

  if (contexto.access === "anonymous") redirect("/login");
  if (contexto.access === "onboarding") redirect("/onboarding");
  if (!auth || !contexto.capabilities.includes("administrar")) redirect("/docs");

  return <BrandImporter workspaceId={auth.workspaceId} />;
}
