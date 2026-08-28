import { notFound } from "next/navigation";
import { DocPage } from "@/components/docs/DocPage";
import { BrandCanvas } from "@/components/BrandCanvas";
import { getResolvedBrandDoc } from "@/lib/brandville/server";

export default async function DocSlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const entry = await getResolvedBrandDoc(slug.join("/"));

  if (!entry) {
    notFound();
  }

  return (
    <BrandCanvas>
      <DocPage entry={entry} />
    </BrandCanvas>
  );
}
