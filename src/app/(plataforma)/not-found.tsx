import Link from "next/link";
import { platformIdentity } from "@/platform/identity";

/**
 * Endereço que não existe no produto.
 *
 * A raiz, para o que não cai em nenhuma rota — inclusive `/w/<conta>` sem
 * marca, e URLs antigas de antes do M1. Ela precisa existir mesmo com a de
 * `/docs` já existindo: a de baixo só cobre o que está dentro da moldura.
 */
export default function NaoEncontrado() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-platform-bg px-[var(--space-shell-5)]">
      <div className="max-w-[34rem]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-platform-text-muted">
          {platformIdentity.displayName} · 404
        </p>
        <h1 className="mt-[var(--space-shell-4)] text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-platform-text">
          Este endereço não existe
        </h1>
        <p className="mt-[var(--space-shell-3)] text-[15px] leading-relaxed text-platform-text-muted">
          Pode ser um link antigo. A porta de entrada resolve para qual marca
          você tem acesso.
        </p>
        <Link
          href="/docs"
          className="mt-[var(--space-shell-5)] inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-platform-panel px-[var(--space-shell-4)] text-[14px] font-medium text-platform-text hover:bg-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
        >
          Ir para os manuais
        </Link>
      </div>
    </main>
  );
}
