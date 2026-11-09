import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BarraDaJanela } from "@/components/ferramentas/BarraDaJanela";
import { Cores } from "@/components/ferramentas/Cores";
import { Grids } from "@/components/ferramentas/Grids";
import { KitAvulso } from "@/components/ferramentas/KitAvulso";
import { ehFerramentaEmJanela, FERRAMENTAS_EM_JANELA, type FerramentaEmJanela } from "@/lib/ferramentas/janela";
import { IDIOMA_PADRAO_DO_SITE, idiomaDoSiteValido } from "@/lib/site/idiomas";

/**
 * A ferramenta gratuita em janela solta (21/10/2026): a mesma tela do Kit, do
 * Cores e do Grids, sem o menu do site e sem a faixa de título, com uma barra
 * fina. Abre pelo botão "Abrir em janela" das páginas normais.
 *
 * Só as três ferramentas existem aqui: qualquer outro nome é 404 (`dynamicParams`
 * desligado), e o `proxy` só deixa passar, sem sessão, os três caminhos exatos.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return FERRAMENTAS_EM_JANELA.map((ferramenta) => ({ ferramenta }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; ferramenta: string }> }): Promise<Metadata> {
  const { lang, ferramenta } = await params;
  const t = await getTranslations({ locale: idiomaDoSiteValido(lang) ? lang : IDIOMA_PADRAO_DO_SITE, namespace: "ferramentas.comum" });
  const nome = ehFerramentaEmJanela(ferramenta) ? t(`janela.nomes.${ferramenta}`) : t("janela.ferramenta");
  return { title: `Brennimark ${nome}`, robots: { index: false, follow: false } };
}

const TELAS: Record<FerramentaEmJanela, () => React.ReactNode> = {
  kit: () => <KitAvulso />,
  cores: () => <Cores />,
  grids: () => <Grids />,
};

export default async function PaginaDaJanela({ params }: { params: Promise<{ ferramenta: string }> }) {
  const { ferramenta } = await params;
  if (!ehFerramentaEmJanela(ferramenta)) notFound();
  return (
    <>
      <BarraDaJanela ferramenta={ferramenta} />
      {TELAS[ferramenta]()}
    </>
  );
}
