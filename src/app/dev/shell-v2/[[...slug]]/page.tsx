import { notFound } from "next/navigation";
import { brandvilleInstance } from "@/brandville/config";
import { getBrandvilleAuthContext, getResolvedBrandDoc, getResolvedBrandDocs } from "@/lib/brandville/server";
import { AppShellV2 } from "@/components/shell/AppShellV2";
import { shellSections } from "@/components/shell/navigation";
import { BrandCanvas } from "@/components/BrandCanvas";
import { DocPage } from "@/components/docs/DocPage";

export const metadata = { robots: { index: false, follow: false } };

/**
 * Comparação V1/V2 sobre uma rota real.
 *
 * Usa os mesmos dados, a mesma resolução de conteúdo e a mesma permissão que
 * /docs — não é mockup. O que muda é só a moldura, que é o objeto da revisão.
 *
 * Fora de produção por construção. Não entra em sitemap nem em navegação.
 */
export default async function ShellV2Preview({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { slug } = await params;
  const path = slug?.join("/") || brandvilleInstance.navigation.defaultDocSlug;

  const context = await getBrandvilleAuthContext();
  const role = context?.role === "owner" ? "owner" : "member";
  const docs = await getResolvedBrandDocs(context);
  const entry = (await getResolvedBrandDoc(path)) ?? docs[0];

  if (!entry) notFound();

  return (
    <AppShellV2 sections={shellSections({ role })} docs={docs} userEmail={context?.user.email ?? undefined}
      basePath="/dev/shell-v2"
    >
      <BrandCanvas>
        <DocPage entry={entry} />
      </BrandCanvas>
    </AppShellV2>
  );
}
