import { redirect } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { EmptyBrandState } from "@/components/shell/EmptyBrandState";

/**
 * A porta do manual.
 *
 * Antes esta página perguntava a `hasBrand`, uma constante calculada da
 * instância estática na inicialização do processo. Uma marca podia existir em
 * `brands` e a pessoa continuar vendo "Nenhuma marca por aqui ainda" — o
 * estado vazio mentia sobre o banco.
 */
export default async function DocsIndexPage() {
  const { brand, defaultDocSlug, capabilities } = await resolveWorkspaceContext();

  // Marca sem documento de entrada declarado: mostrar o estado vazio é melhor
  // que redirecionar para /docs/ e entrar em laço.
  if (!brand || !defaultDocSlug) {
    return <EmptyBrandState podeImportar={capabilities.includes("administrar")} />;
  }

  redirect(`/docs/${defaultDocSlug}`);
}
