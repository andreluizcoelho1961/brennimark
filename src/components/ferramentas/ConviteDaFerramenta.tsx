import Link from "next/link";

/**
 * O convite no fim de cada ferramenta gratuita (17/10/2026): o momento em que
 * a pessoa acabou de usar a ferramenta é o em que o benefício da versão
 * ligada à marca está mais claro. Cada ferramenta diz, com as próprias
 * palavras, o que muda para quem assina; o que está aqui só descreve o que o
 * assinante já tem dentro da plataforma.
 */
export function ConviteDaFerramenta({ titulo, itens }: { titulo: string; itens: readonly string[] }) {
  return (
    <aside data-convite-assinatura className="border-t border-platform-border px-6 py-10">
      <div className="mx-auto grid max-w-[64rem] gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-platform-text-muted">Para quem assina</p>
          <h2 className="mt-2 text-[clamp(1.2rem,2.2vw,1.6rem)] font-semibold leading-snug tracking-tight">{titulo}</h2>
          <ul className="mt-3 grid gap-1.5 text-[14px] leading-relaxed text-platform-text-muted">
            {itens.map((i) => (
              <li key={i}>◆ {i}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <Link href="/assinar" className="rounded-[var(--radius-control)] bg-platform-signal px-4 py-2.5 text-sm font-semibold text-platform-bg">
            Ver os planos
          </Link>
          <Link href="/#planos" className="rounded-[var(--radius-control)] border border-platform-border px-4 py-2 text-sm text-platform-text">
            Conhecer a plataforma
          </Link>
        </div>
      </div>
    </aside>
  );
}
