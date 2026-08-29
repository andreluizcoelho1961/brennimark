import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { getBrandvilleAuthContext, getDeletedPages } from "@/lib/brandville/server";
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

  const auth = await getBrandvilleAuthContext();
  const excluidas = auth
    ? await getDeletedPages(auth, brand.id, docs.map((doc) => doc.slug))
    : [];

  return (
    <AdminPanel
      initialDocs={[...docs]}
      deletedPages={excluidas}
      groups={brand.navigation.groups}
    />
  );
}
