import Link from "next/link";

/**
 * As ferramentas gratuitas no rodapé do site (10/10/2026, pedido do André:
 * "precisamos ter um link para o Kit e para o Cores"). Um lugar só, usado nos
 * dois rodapés (o da página inicial e o das páginas internas), para os dois
 * nunca divergirem. As versões de assinante moram dentro da plataforma.
 */
export const FERRAMENTAS_GRATUITAS = [
  { href: "/ferramentas/kit", rotulo: "Kit: todos os tamanhos do logo" },
  { href: "/ferramentas/cores", rotulo: "Cores: que cor é essa?" },
] as const;

export function LinksDasFerramentas() {
  return (
    <nav className="foot-links" aria-label="Ferramentas gratuitas" data-ferramentas-gratuitas>
      {FERRAMENTAS_GRATUITAS.map((f) => (
        <Link key={f.href} href={f.href}>{f.rotulo}</Link>
      ))}
    </nav>
  );
}
