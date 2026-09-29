import type { Metadata } from "next";

/**
 * Os metadados de uma página do site: título da aba, descrição e a prévia de
 * link (WhatsApp, LinkedIn, e-mail). A imagem é `/previa-do-site.png`, gerada
 * no build por `(site)/previa-do-site.png/route.tsx`, a mesma em todas as
 * páginas.
 *
 * A prévia exige endereço absoluto. Na Vercel ele é o domínio de produção
 * (`VERCEL_PROJECT_PRODUCTION_URL`, variável que a própria Vercel preenche);
 * fora dela, o servidor local.
 *
 * FORA DOS BUSCADORES, por decisão do André (29/09/2026): o site vai ao ar
 * como layout de teste, antes da divulgação. O `noindex` fica declarado aqui,
 * no site, e não só herdado do layout da plataforma — quem um dia liberar a
 * plataforma não libera o site sem querer. Liberar é tirar esta linha e, no
 * mesmo passo, publicar um `sitemap`.
 *
 * A prévia de link continua funcionando: o WhatsApp lê as etiquetas `og:`
 * mesmo de página que o buscador não indexa.
 */
export const PREVIA = { endereco: "/previa-do-site.png", largura: 1200, altura: 630 };

const BASE = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  : new URL(`http://localhost:${process.env.PORT ?? 3000}`);

export function metadadosDoSite({ titulo, descricao }: { titulo: string; descricao: string }): Metadata {
  const imagem = { url: PREVIA.endereco, width: PREVIA.largura, height: PREVIA.altura, alt: "Brennimark · Plataforma de gestão de marca" };
  return {
    metadataBase: BASE,
    title: titulo,
    description: descricao,
    robots: { index: false, follow: false },
    openGraph: { title: titulo, description: descricao, siteName: "Brennimark", locale: "pt_BR", type: "website", images: [imagem] },
    twitter: { card: "summary_large_image", title: titulo, description: descricao, images: [imagem] },
  };
}
