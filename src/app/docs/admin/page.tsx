import { redirect } from "next/navigation";
import { activeDocsRegistry, brandvilleInstance } from "@/brandville/config";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { getBrandvilleAuthContext, getResolvedBrandDocs } from "@/lib/brandville/server";

export default async function AdminPage() {
  const context = await getBrandvilleAuthContext();
  if (!context) redirect("/login");
  if (context.role !== "owner") redirect("/docs");
  const docs = await getResolvedBrandDocs(context);
  return <AdminPanel initialDocs={docs} baseDocs={[...activeDocsRegistry]} groups={brandvilleInstance.navigation.groups} />;
}
