import Link from "next/link";
import { platformIdentity } from "@/platform/identity";
import { destinoAoTrocarDeMarca } from "@/lib/brandville/selecao";

/**
 * A porta do produto: onde a pessoa chega depois do login.
 *
 * ─── Por que ela existe, e por que aparece SEMPRE ───────────────────────────
 *
 * Até 12/09/2026 esta tela era só um desempate: aparecia quando havia mais de
 * uma marca alcançável, e quem tinha uma só nunca a via — o login caía direto
 * dentro do manual. O produto ficava sem porta: nada dizia onde a pessoa
 * estava, e a conta com uma marca não tinha onde ver a sua marca.
 *
 * Decisão do André: a tela inicial aparece sempre, com um card por marca — um
 * card se há uma, dez se há dez. O custo é um clique a mais para quem tem uma
 * marca; o ganho é um lugar onde se chega, se entende e se escolhe.
 *
 * Quem chega por endereço de marca continua indo direto para ela: o atalho de
 * link compartilhado não passa por aqui (ver `resolverAlvo` em `selecao.ts`).
 *
 * ⚠️ O TEXTO DE APRESENTAÇÃO É PROVISÓRIO. O André ainda vai escrevê-lo; o que
 * está aqui é um lugar reservado, deliberadamente sóbrio e sem promessa que o
 * produto não cumpra. Trocar a redação não exige tocar em mais nada.
 */
export function TelaInicial({
  opcoes,
}: {
  opcoes: readonly { workspaceSlug: string; brandKey: string; conta: string; marca: string }[];
}) {
  const uma = opcoes.length === 1;

  return (
    <div className="min-h-dvh bg-platform-bg px-[var(--space-shell-5)] py-[var(--space-shell-8,4rem)]">
      <div className="mx-auto w-full max-w-[60rem]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-platform-text-muted">
          {platformIdentity.displayName}
        </p>

        <h1 className="mt-[var(--space-shell-4)] text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-platform-text">
          Bem-vindo ao {platformIdentity.displayName}
        </h1>
        <p className="mt-[var(--space-shell-3)] max-w-[42rem] text-[15px] leading-relaxed text-platform-text-muted">
          Aqui ficam as marcas da sua conta: o manual de cada uma, os arquivos
          para baixar e o assistente que responde com base no que está
          documentado. Escolha uma marca para começar.
        </p>

        <h2 className="mt-[var(--space-shell-7,3rem)] text-[13px] font-medium uppercase tracking-[0.08em] text-platform-text-muted">
          {uma ? "Sua marca" : "Suas marcas"}
        </h2>

        {/*
          Grade de cards. Uma coluna no celular, duas a partir de 640px e três a
          partir de 1024px: um card por marca, e a grade acomoda de uma a dez
          sem mudar de desenho.
        */}
        <ul
          aria-label={uma ? "1 marca disponível" : `${opcoes.length} marcas disponíveis`}
          className="mt-[var(--space-shell-4)] grid grid-cols-1 gap-[var(--space-shell-3)] sm:grid-cols-2 lg:grid-cols-3"
        >
          {opcoes.map((opcao) => (
            <li key={`${opcao.workspaceSlug}/${opcao.brandKey}`}>
              <Link
                href={destinoAoTrocarDeMarca(opcao)}
                data-card-de-marca
                className="flex min-h-[7rem] flex-col justify-between rounded-[var(--radius-control)] border border-platform-border bg-platform-panel p-[var(--space-shell-4)] hover:border-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
              >
                <span className="text-[17px] font-medium leading-tight text-platform-text">
                  {opcao.marca}
                </span>
                {/*
                  A conta aparece sempre: duas marcas de mesmo nome em contas
                  diferentes seriam indistinguíveis sem ela.
                */}
                <span className="text-[12px] text-platform-text-muted">{opcao.conta}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
