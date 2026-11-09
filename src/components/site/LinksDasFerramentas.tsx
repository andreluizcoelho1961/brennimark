import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { caminhoDoSite } from "@/lib/site/idiomas";
import { idiomaDoSiteAtual } from "@/lib/site/idioma-atual";

/**
 * As ferramentas gratuitas no rodapé do site (10/10/2026, pedido do André:
 * "precisamos ter um link para o Kit e para o Cores"). Um lugar só, usado nos
 * dois rodapés (o da página inicial e o das páginas internas), para os dois
 * nunca divergirem. As versões de assinante moram dentro da plataforma.
 */
export const FERRAMENTAS_GRATUITAS = [
  { href: "/ferramentas/kit", chave: "kit" },
  { href: "/ferramentas/cores", chave: "cores" },
  { href: "/ferramentas/grids", chave: "grids" },
] as const;

export async function LinksDasFerramentas() {
  const idioma = await idiomaDoSiteAtual();
  const t = await getTranslations("site.rodape");
  return (
    <nav className="foot-links" aria-label={t("ferramentasAria")} data-ferramentas-gratuitas>
      {FERRAMENTAS_GRATUITAS.map((f) => (
        <Link key={f.href} href={caminhoDoSite(idioma, f.href)}>{t(f.chave)}</Link>
      ))}
    </nav>
  );
}
