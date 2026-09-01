import Link from "next/link";
import { platformIdentity } from "@/platform/identity";

/**
 * A pergunta que o produto não sabia fazer.
 *
 * Com mais de uma marca alcançável e nenhuma escolhida, `.limit(1)` respondia
 * por conta própria. Esta tela é a alternativa: ela pergunta, e o custo de
 * perguntar é uma tela a mais só para quem tem mais de uma marca — quem tem uma
 * nunca a vê, porque nesse caso não há ambiguidade a resolver.
 */
export function EscolhaDeContexto({
  opcoes,
}: {
  opcoes: readonly { workspaceSlug: string; brandKey: string; conta: string; marca: string }[];
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-platform-bg px-[var(--space-shell-5)] py-[var(--space-shell-8,4rem)]">
      <div className="w-full max-w-[34rem]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-platform-text-muted">
          {platformIdentity.displayName}
        </p>
        <h1 className="mt-[var(--space-shell-4)] text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-platform-text">
          Qual marca você quer abrir?
        </h1>
        <p className="mt-[var(--space-shell-3)] text-[15px] leading-relaxed text-platform-text-muted">
          Você tem acesso a mais de uma. Cada uma tem endereço próprio — o link
          desta página leva direto a ela na próxima vez.
        </p>

        <ul
          aria-label={`${opcoes.length} marcas disponíveis`}
          className="mt-[var(--space-shell-5)] flex flex-col gap-[var(--space-shell-2)]"
        >
          {opcoes.map((opcao) => (
            <li key={`${opcao.workspaceSlug}/${opcao.brandKey}`}>
              <Link
                href={`/w/${opcao.workspaceSlug}/b/${opcao.brandKey}/docs`}
                data-escolha-de-marca
                className="flex min-h-11 flex-col justify-center rounded-[var(--radius-control)] border border-platform-border px-[var(--space-shell-4)] py-[var(--space-shell-3)] hover:border-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
              >
                <span className="text-[15px] font-medium text-platform-text">{opcao.marca}</span>
                {/* A conta aparece sempre: duas marcas de mesmo nome em contas
                    diferentes seriam indistinguíveis sem ela. */}
                <span className="text-[12px] text-platform-text-muted">{opcao.conta}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
