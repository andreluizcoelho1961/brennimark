import { notFound } from "next/navigation";
import { DocPage } from "@/components/docs/DocPage";
import { BrandCanvas } from "@/components/BrandCanvas";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";

export default async function DocSlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  // Os documentos já foram resolvidos nesta requisição; procurar aqui não abre
  // segunda consulta e garante que página e navegação viram a mesma marca.
  const { brand, docs } = await resolveWorkspaceContext();
  const entry = docs.find((doc) => doc.slug === slug.join("/"));

  if (!brand || !entry) {
    notFound();
  }

  return (
    <BrandCanvas theme={brand.theme}>
      <DocPage entry={entry} />
    </BrandCanvas>
  );
}
