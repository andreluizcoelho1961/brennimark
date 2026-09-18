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
 * ─── O texto descreve o produto PRONTO, e isso é deliberado ─────────────────
 *
 * Decisão do André em 13/09/2026. As quatro linhas abaixo são as quatro frentes
 * do roteiro, e três delas ainda não estão inteiras: o acervo existe em versão
 * simples (ADR-0007 §7), a conferência de peça devolve veredito em texto sem
 * marcar sobre a imagem (ADR-0004 §3.3), e o copiloto de prompts foi aceito e
 * ainda não foi construído (ADR-0004 §3.1).
 *
 * Quem vier depois: isto NÃO é descrição do estado atual do código. É a
 * promessa do produto, escrita uma vez, para não ser reescrita a cada frente
 * que fica pronta. Se alguma frente for abandonada, a linha correspondente sai
 * daqui no mesmo commit.
 */
export function TelaInicial({
  opcoes,
  novaMarca,
}: {
  opcoes: readonly { workspaceSlug: string; brandKey: string; conta: string; marca: string }[];
  /**
   * Endereço da importação, só para quem administra a conta em exibição.
   * "+ Nova marca" é o gesto de criar marca (spec-menus §3): mora aqui, na
   * tela Marcas, e não na coluna. Quem só consulta não recebe o endereço, e o
   * cartão não existe para ele.
   */
  novaMarca?: string;
}) {
  const uma = opcoes.length === 1;

  return (
    <div className="px-[var(--space-shell-5)] py-[var(--space-shell-7,3rem)]">
      <div className="mx-auto w-full max-w-[60rem]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-platform-text-muted">
          {platformIdentity.displayName}
        </p>

        <h1 className="mt-[var(--space-shell-4)] text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-platform-text">
          Bem-vindo ao {platformIdentity.displayName}
        </h1>
        <p className="mt-[var(--space-shell-3)] max-w-[42rem] text-[15px] leading-relaxed text-platform-text-muted">
          O manual da marca, os arquivos e a inteligência que entende os dois — no
          mesmo lugar.
        </p>

        {/*
          Quatro verbos, porque é assim que uma agência lê em cinco segundos.
          "Responde citando a página" não é modéstia: é o argumento. Todo
          concorrente diz que o assistente responde sobre o seu conteúdo; dizer
          que ele MOSTRA onde está escrito é o que nenhum promete, e é a
          honestidade editorial do projeto virada para fora.
        */}
        <ul className="mt-[var(--space-shell-4)] flex max-w-[42rem] flex-col gap-[var(--space-shell-2)] text-[15px] leading-relaxed text-platform-text-muted">
          <li>
            <strong className="font-medium text-platform-text">Ler</strong> o manual como o
            estúdio diagramou, com índice e busca
          </li>
          <li>
            <strong className="font-medium text-platform-text">Baixar</strong> logo, ícones,
            paleta, fontes e fotos, com a regra que governa cada arquivo
          </li>
          <li>
            <strong className="font-medium text-platform-text">Perguntar</strong> ao assistente,
            que responde citando a página do manual
          </li>
          <li>
            <strong className="font-medium text-platform-text">Conferir</strong> a sua peça e
            gerar prompts com o DNA da marca
          </li>
        </ul>

        <p className="mt-[var(--space-shell-4)] text-[15px] text-platform-text-muted">
          Escolha uma marca para começar.
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
          {novaMarca && (
            <li>
              <Link
                href={novaMarca}
                data-card-nova-marca
                className="flex min-h-[7rem] flex-col items-start justify-between rounded-[var(--radius-control)] border border-dashed border-platform-border p-[var(--space-shell-4)] text-platform-text-muted hover:border-platform-signal-soft hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
              >
                <span className="text-[17px] font-medium leading-tight">+ Nova marca</span>
                <span className="text-[12px]">Enviar o manual em PDF</span>
              </Link>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
