import type { Metadata, Viewport } from "next";
import "./site.css";
import { RaizDoDocumento } from "@/components/RaizDoDocumento";
import { ProvedorDeTraducao } from "@/components/ProvedorDeTraducao";
import { LembrarIdiomaDoSite } from "@/components/site/LembrarIdiomaDoSite";
import { IDIOMAS_DO_SITE, idiomaDoSiteValido, IDIOMA_PADRAO_DO_SITE } from "@/lib/site/idiomas";

/**
 * A raiz do SITE público. O idioma vem do endereço (`/en/...`), e o português,
 * que não leva prefixo, chega aqui como `/pt-BR/...` por reescrita do `proxy`.
 * O `lang` do HTML é o do endereço, de modo que o leitor de tela e o buscador
 * recebem o idioma certo já no primeiro byte.
 *
 * Aqui só entra o estilo do site; a moldura (cabeçalho, selo, diálogo) vem de
 * `MolduraDoSite`, que cada página usa, porque a home e as páginas internas
 * se comportam diferente (trilho de capítulos × documento que rola).
 *
 * `dynamicParams = false`: só existem as páginas dos idiomas declarados.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return IDIOMAS_DO_SITE.map((lang) => ({ lang }));
}

/** Fora dos buscadores, por decisão do André (29/09/2026) — ver `metadados.ts`. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** O mesmo da plataforma: sem `cover` os recuos do recorte chegam zerados. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function LayoutDoSite({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <RaizDoDocumento lang={lang}>
      <ProvedorDeTraducao>
        <LembrarIdiomaDoSite idioma={idiomaDoSiteValido(lang) ? lang : IDIOMA_PADRAO_DO_SITE} />
        {children}
      </ProvedorDeTraducao>
    </RaizDoDocumento>
  );
}
