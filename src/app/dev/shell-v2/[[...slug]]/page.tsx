import { notFound } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { AppShellV2 } from "@/components/shell/AppShellV2";
import { shellSections } from "@/components/shell/navigation";
import { BrandCanvas } from "@/components/BrandCanvas";
import { EmptyBrandState } from "@/components/shell/EmptyBrandState";
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
  const { brand, docs, capabilities, userEmail, defaultDocSlug } = await resolveWorkspaceContext();
  const caminho = slug?.join("/") || defaultDocSlug;
  const entry = docs.find((doc) => doc.slug === caminho) ?? docs[0];

  return (
    <AppShellV2
      sections={shellSections({ capabilities })}
      docs={docs}
      userEmail={userEmail}
      brandName={brand?.brand.name}
      brandDescriptor={brand?.brand.descriptor}
      basePath="/dev/shell-v2"
    >
      {brand && entry ? (
        <BrandCanvas theme={brand.theme}>
          <DocPage entry={entry} />
        </BrandCanvas>
      ) : (
        <EmptyBrandState />
      )}
    </AppShellV2>
  );
}
