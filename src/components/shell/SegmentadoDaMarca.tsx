"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsEnglish } from "@/platform/locale-client";

/**
 * `Manual │ Materiais │ Complementos` — o segmentado da barra de cima.
 *
 * A barra de cima é do CONTEÚDO da marca (plano da interface §2): três vistas
 * do mesmo assunto, à maneira do controle segmentado da Apple, e não três
 * destinos da plataforma.
 *
 * Sem marca aberta, o segmentado aparece APAGADO — decisão de 18/09, "como o
 * Illustrator sem documento aberto": os menus estão lá, e acendem quando há
 * sobre o que agir. Apagado não é link morto: é `aria-disabled`, sem `href`.
 *
 * Complementos ainda não existe (plano §3, depois do ensaio): aparece sempre
 * apagado, com o mesmo "em breve" da coluna.
 */
export function SegmentadoDaMarca({ manual, materiais }: { manual?: string; materiais?: string }) {
  const isEnglish = useIsEnglish();
  const pathname = usePathname() ?? "";

  const partes: { id: string; rotulo: string; href?: string; emBreve?: boolean }[] = [
    { id: "manual", rotulo: "Manual", href: manual },
    { id: "materiais", rotulo: isEnglish ? "Materials" : "Materiais", href: materiais },
    { id: "complementos", rotulo: isEnglish ? "Supplements" : "Complementos", emBreve: true },
  ];

  return (
    <nav
      aria-label={isEnglish ? "Brand content" : "Conteúdo da marca"}
      data-segmentado-da-marca
      data-marca-aberta={manual ? "sim" : "nao"}
      className="flex flex-none items-center rounded-[var(--radius-control)] border border-platform-border p-0.5"
    >
      {partes.map((parte, indice) => {
        const ativo = Boolean(parte.href && (pathname === parte.href || pathname.startsWith(`${parte.href}/`)));
        const separador = indice > 0 ? "border-l border-platform-border" : "";
        const base = `flex h-8 items-center px-[var(--space-shell-3)] text-[13px] ${separador}`;

        if (!parte.href) {
          return (
            <span
              key={parte.id}
              aria-disabled="true"
              data-parte-apagada={parte.id}
              title={parte.emBreve
                ? (isEnglish ? `${parte.rotulo} — coming soon` : `${parte.rotulo} — em breve`)
                : (isEnglish ? "Open a brand first" : "Abra uma marca primeiro")}
              className={`${base} cursor-default text-platform-text-muted opacity-40`}
            >
              {parte.rotulo}
            </span>
          );
        }
        return (
          <Link
            key={parte.id}
            href={parte.href}
            aria-current={ativo ? "page" : undefined}
            data-parte-do-segmentado={parte.id}
            className={`${base} rounded-[calc(var(--radius-control)-2px)] transition-colors duration-[var(--motion-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus ${
              ativo ? "bg-platform-signal-soft font-medium text-platform-text" : "text-platform-text-muted hover:text-platform-text"
            }`}
          >
            {parte.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
