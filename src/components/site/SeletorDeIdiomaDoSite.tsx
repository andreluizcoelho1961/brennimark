"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { caminhoNoOutroIdioma, type IdiomaDoSite } from "@/lib/site/idiomas";
import { gravarIdiomaDoNavegador } from "./LembrarIdiomaDoSite";

/**
 * O botão de idioma do cabeçalho do site.
 *
 * Mostra o idioma PARA O QUAL se troca ("EN" no português, "PT" no inglês) e
 * leva à MESMA página no outro idioma — é um link comum, não um cookie: o
 * idioma do site mora no endereço, então o que a pessoa compartilha mostra o
 * idioma que ela vê. A página que ainda não tem versão no outro idioma é
 * resolvida pelo `proxy`, que leva à equivalente em português com um aviso.
 *
 * Um botão só, como o da plataforma: dois lado a lado estouravam a largura do
 * cabeçalho no celular.
 */
export function SeletorDeIdiomaDoSite({ atual }: { atual: IdiomaDoSite }) {
  const t = useTranslations("site.idioma");
  const pathname = usePathname() ?? "/";
  const destino: IdiomaDoSite = atual === "en" ? "pt-BR" : "en";
  return (
    <Link
      className="lang-switch"
      href={caminhoNoOutroIdioma(pathname, destino)}
      prefetch={false}
      lang={destino}
      hrefLang={destino}
      aria-label={destino === "en" ? t("paraIngles") : t("paraPortugues")}
      title={destino === "en" ? t("paraIngles") : t("paraPortugues")}
      data-seletor-de-idioma-do-site
      onClick={() => gravarIdiomaDoNavegador(destino)}
    >
      {destino === "en" ? "EN" : "PT"}
    </Link>
  );
}
