import { AssetLibrary } from "@/components/assets/AssetLibrary";
import { brandvilleInstance } from "@/brandville/config";

export default function AssetLibraryPage() {
  const en = brandvilleInstance.metadata.language === "en";
  return <div className="px-page-inline py-12 md:py-16"><p className="font-display text-xs font-black uppercase tracking-[0.24em] text-release-analog-turquoise">{en ? "Official resources" : "Recursos oficiais"}</p><h1 className="mt-3 font-display text-4xl font-black uppercase leading-none text-release-analog-white md:text-6xl">{en ? "Asset library" : "Biblioteca de assets"}</h1><p className="mt-5 max-w-3xl text-base leading-relaxed text-text-secondary">{en ? "Approved files for consistent brand use. Production assets are kept separate from guideline reference images." : "Arquivos aprovados para uso da marca. Os downloads são privados e os links expiram automaticamente."}</p><div className="mt-10"><AssetLibrary language={brandvilleInstance.metadata.language} /></div></div>;
}
