import Link from "next/link";
import { platformIdentity } from "@/platform/identity";

/**
 * A primeira tela do produto — e a única até o primeiro manual entrar.
 *
 * Diz o que é e qual é o próximo passo, sem ilustração ornamental e sem
 * controle que não funciona. O envio de PDF ainda não existe; anunciá-lo como
 * botão morto seria pior do que descrevê-lo em texto.
 */
export function EmptyBrandState({ podeImportar = false }: { podeImportar?: boolean }) {
  return (
    <div className="flex min-h-full items-center justify-center px-[var(--space-shell-5)] py-[var(--space-shell-8,4rem)]">
      <div className="max-w-[34rem]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-platform-text-muted">
          {platformIdentity.displayName}
        </p>

        <h1 className="mt-[var(--space-shell-4)] text-[clamp(1.75rem,3.6vw,2.5rem)] font-semibold leading-[1.1] tracking-tight text-platform-text">
          Nenhuma marca por aqui ainda
        </h1>

        <p className="mt-[var(--space-shell-4)] text-[15px] leading-relaxed text-platform-text-muted">
          Um manual de marca costuma ser um PDF que ninguém lê e onde ninguém acha nada. Aqui ele
          vira um sistema que responde perguntas — e que mostra de onde veio cada resposta.
        </p>

        {podeImportar && (
          <Link
            href="/docs/importar"
            className="mt-[var(--space-shell-5)] inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-platform-panel px-[var(--space-shell-4)] text-[14px] font-medium text-platform-text hover:bg-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
          >
            Enviar o primeiro manual
          </Link>
        )}

        <div className="mt-[var(--space-shell-6)] border-t border-platform-border pt-[var(--space-shell-4)]">
          <h2 className="text-[13px] font-semibold text-platform-text">Como uma marca começa</h2>
          <ol className="mt-[var(--space-shell-3)] flex flex-col gap-[var(--space-shell-3)]">
            {[
              ["Envie o manual em PDF", "O texto é extraído e vira um rascunho estruturado."],
              ["Revise o rascunho", "Nada é publicado sem alguém confirmar. O que não foi aprovado fica marcado como rascunho."],
              ["Publique", "A partir daí a marca responde perguntas, valida peças e entrega os arquivos certos."],
            ].map(([titulo, texto], i) => (
              <li key={titulo} className="flex gap-[var(--space-shell-3)]">
                <span className="mt-[2px] flex-none font-mono text-[11px] text-platform-text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-[14px] font-medium text-platform-text">{titulo}</span>
                  <span className="mt-[2px] block text-[13px] leading-relaxed text-platform-text-muted">
                    {texto}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-[var(--space-shell-5)] text-[12px] leading-relaxed text-platform-text-muted">
          Só quem administra a conta pode importar um manual.
        </p>
      </div>
    </div>
  );
}
