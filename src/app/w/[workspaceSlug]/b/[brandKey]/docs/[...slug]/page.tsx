import { notFound } from "next/navigation";
import { DocPage } from "@/components/docs/DocPage";
import { BrandCanvas } from "@/components/BrandCanvas";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { caminhoDaMarca } from "@/lib/brandville/selecao";
import { documentosVisiveis } from "@/content/visibilidade";
import { Trilha, Vizinhos } from "@/components/shell/TrilhaEVizinhos";

export default async function DocSlugPage({
  params,
}: {
  params: Promise<{ slug: string[]; workspaceSlug: string; brandKey: string }>;
}) {
  const { slug, ...alvo } = await params;
  // Os documentos já foram resolvidos nesta requisição; procurar aqui não abre
  // segunda consulta e garante que página e navegação viram a mesma marca.
  const { brand, docs, capabilities, locale } = await resolveWorkspaceContext(alvo);
  // A busca acontece sobre o que esta pessoa PODE ver: uma página invisível
  // para ela precisa dar 404, e não renderizar por chegar pela URL direta.
  const visiveis = documentosVisiveis(docs, capabilities);
  const entry = visiveis.find((doc) => doc.slug === slug.join("/"));

  if (!brand || !entry) {
    notFound();
  }

  const base = caminhoDaMarca(alvo);
  const ingles = locale === "en";

  return (
    <>
      <Trilha marca={brand.brand.name} documento={entry} base={base} ingles={ingles} />
      <BrandCanvas theme={brand.theme}>
        <DocPage
          entry={entry}
          brandLanguage={brand.metadata.language}
          statusLabels={brand.statusLabels}
        />
      </BrandCanvas>
      <Vizinhos docs={visiveis} slug={entry.slug} base={base} ingles={ingles} />
    </>
  );
}
