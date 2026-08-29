import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";

export default async function AdminPage() {
  // Leitura e escrita, as duas pela marca da requisição.
  const { access, capabilities, docs, brand } = await resolveWorkspaceContext();
  if (access === "anonymous") redirect("/login");
  if (access === "onboarding") redirect("/onboarding");
  if (!capabilities.includes("administrar")) redirect("/docs");

  // Sem marca não há o que administrar, e as seções são as que a marca
  // declara — não as de uma instância de código.
  if (!brand) redirect("/docs");

  return <AdminPanel initialDocs={[...docs]} groups={brand.navigation.groups} />;
}
