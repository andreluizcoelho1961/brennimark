import Link from "next/link";

/** As partes do Console da Brennimark. Só a equipe chega aqui (o banco decide). */
export function NavDoConsole({ atual }: { atual: "custos" | "ia" }) {
  const item = (id: "custos" | "ia", href: string, rotulo: string) => (
    <Link href={href} aria-current={atual === id ? "page" : undefined}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${atual === id ? "border-platform-text font-bold text-platform-text" : "border-transparent text-platform-text-muted hover:text-platform-text"}`}>
      {rotulo}
    </Link>
  );
  return (
    <nav aria-label="Console" className="mt-6 flex gap-1 border-b border-platform-border">
      {item("custos", "/console", "Custos")}
      {item("ia", "/console/ia", "IA e limites")}
    </nav>
  );
}
