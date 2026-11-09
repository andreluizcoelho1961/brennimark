import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AjudaDaFerramenta } from "@/components/ajuda/AjudaDaFerramenta";
import { KitAvulso } from "@/components/ferramentas/KitAvulso";
import { ConviteDaFerramenta } from "@/components/ferramentas/ConviteDaFerramenta";
import { AbrirEmJanela } from "@/components/ferramentas/AbrirEmJanela";
import { IDIOMA_PADRAO_DO_SITE, idiomaDoSiteValido } from "@/lib/site/idiomas";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: idiomaDoSiteValido(lang) ? lang : IDIOMA_PADRAO_DO_SITE, namespace: "ferramentas.kit.ui.paginaSite" });
  return { title: t("metaTitulo"), description: t("metaDescricao"), robots: { index: false, follow: false } };
}

/**
 * O Brennimark Kit gratuito (09/10/2026). A página é estática: o trabalho todo
 * acontece no navegador de quem usa, e nada é enviado ao servidor.
 */
export default async function PaginaDoKit() {
  const t = await getTranslations("ferramentas.kit.ui.paginaSite");
  return (
    <>
      <div className="relative border-b border-platform-border px-6 py-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-platform-text-muted">{t("rotulo")}</p>
        <h1 className="mt-2 text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold tracking-tight">{t("titulo")}</h1>
        <p className="mt-2 max-w-[44rem] text-[15px] leading-relaxed text-platform-text-muted">
          {t("lead")}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 sm:absolute sm:right-6 sm:top-5 sm:mt-0">
          <AbrirEmJanela ferramenta="kit" />
          <AjudaDaFerramenta ferramenta="kit" audiencia="site" />
        </div>
      </div>
      <KitAvulso />
      <ConviteDaFerramenta
        titulo={t("conviteTitulo")}
        itens={[t("convite1"), t("convite2"), t("convite3")]}
      />
    </>
  );
}
