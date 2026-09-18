import { AssetLibrary } from "@/components/assets/AssetLibrary";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

export default function AssetLibraryPage() {
  const en = inEnglish(PRODUCT_LOCALE);
  return <div className="px-page-inline py-12 md:py-16"><p className="font-display text-xs font-black uppercase tracking-[0.24em] text-platform-text">{en ? "Official resources" : "Recursos oficiais"}</p><h1 className="mt-3 font-display text-4xl font-black uppercase leading-none text-platform-text md:text-6xl">{en ? "Brand materials" : "Materiais da marca"}</h1><p className="mt-5 max-w-3xl text-base leading-relaxed text-platform-text-muted">{en ? "Approved files for consistent brand use. Production assets are kept separate from guideline reference images." : "Arquivos aprovados para uso da marca. Os downloads são privados e os links expiram automaticamente."}</p><div className="mt-10"><AssetLibrary /></div></div>;
}
