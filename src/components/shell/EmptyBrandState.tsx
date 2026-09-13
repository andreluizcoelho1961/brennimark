import Link from "next/link";
import { platformIdentity } from "@/platform/identity";

/**
 * A primeira tela do produto — e a única até o primeiro manual entrar.
 *
 * Diz o que é e qual é o próximo passo, sem ilustração ornamental e sem
 * controle que não funciona. O envio de PDF ainda não existe; anunciá-lo como
 * botão morto seria pior do que descrevê-lo em texto.
 *
 * ─── Dois motivos diferentes para não haver marca ───────────────────────────
 *
 * Desde o acesso por marca (13/09/2026) "nenhuma marca aqui" deixou de ter uma
 * causa só. Quem administra a conta e ainda não importou nada precisa do
 * convite para importar. Quem trabalha numa conta e ainda não recebeu acesso a
 * marca alguma precisa de outra coisa: saber a quem pedir.
 *
 * Mostrar o mesmo texto para os dois seria mentir para o segundo — a conta
 * pode ter cinco marcas, que a RLS corretamente esconde dele — e o botão
 * "enviar o primeiro manual" o levaria à tela de importação, que o devolve
 * para cá por não ser quem administra. Laço fechado, e nenhuma explicação.
 */
export function EmptyBrandState({
  podeImportar = false,
  contaImportar = "/docs",
}: {
  /**
   * Verdadeiro só para quem administra a conta. É o que separa os dois
   * motivos acima — e o que impede o botão que devolve a pessoa para cá.
   */
  podeImportar?: boolean;
  /** Endereço de importação DA CONTA. Não da marca: a tela existe justamente
   *  quando não há marca, e um caminho com `brandKey` seria um link morto. */
  contaImportar?: string;
}) {
  return (
    <div className="flex min-h-full items-center justify-center px-[var(--space-shell-5)] py-[var(--space-shell-8,4rem)]">
      <div className="max-w-[34rem]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-platform-text-muted">
          {platformIdentity.displayName}
        </p>

        <h1 className="mt-[var(--space-shell-4)] text-[clamp(1.75rem,3.6vw,2.5rem)] font-semibold leading-[1.1] tracking-tight text-platform-text">
          {podeImportar ? "Nenhuma marca por aqui ainda" : "Você ainda não tem acesso a uma marca"}
        </h1>

        <p className="mt-[var(--space-shell-4)] text-[15px] leading-relaxed text-platform-text-muted">
          {podeImportar
            ? "Um manual de marca costuma ser um PDF que ninguém lê e onde ninguém acha nada. Aqui ele vira um sistema que responde perguntas — e que mostra de onde veio cada resposta."
            : "O acesso é concedido marca a marca. Peça a quem administra a conta para liberar as marcas com que você vai trabalhar, e elas aparecem aqui."}
        </p>

        {podeImportar && (
          <Link
            href={contaImportar}
            className="mt-[var(--space-shell-5)] inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-platform-panel px-[var(--space-shell-4)] text-[14px] font-medium text-platform-text hover:bg-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
          >
            Enviar o primeiro manual
          </Link>
        )}

        {/* Os passos da importação e a nota sobre quem importa só fazem
            sentido para quem administra a conta. Para quem espera acesso,
            eles descrevem um caminho que não é dele. */}
        {podeImportar && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
