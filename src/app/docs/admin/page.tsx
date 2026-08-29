import { redirect } from "next/navigation";
import { activeDocsRegistry, brandvilleInstance } from "@/brandville/config";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";

export default async function AdminPage() {
  // Só a leitura passou a vir do contexto da requisição. O caminho de ESCRITA
  // desta tela ainda valida slug contra o registro em código e grava por
  // instance_key — é o patch 2, e não entra aqui.
  const { access, capabilities, docs } = await resolveWorkspaceContext();
  if (access === "anonymous") redirect("/login");
  if (access === "onboarding") redirect("/onboarding");
  if (!capabilities.includes("administrar")) redirect("/docs");

  return (
    <AdminPanel
      initialDocs={[...docs]}
      baseDocs={[...activeDocsRegistry]}
      groups={brandvilleInstance.navigation.groups}
    />
  );
}
