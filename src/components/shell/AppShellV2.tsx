"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocPageEntry } from "@/content/docs";
import type { StatusLabels } from "@/components/docs/status";
import { CommandPalette } from "./CommandPalette";
import type { OpcaoDeContexto } from "./SeletorDeContexto";
import { DesktopSidebar } from "./DesktopSidebar";
import { NavigationDrawer } from "./NavigationDrawer";
import { PlatformTopBar } from "./PlatformTopBar";
import type { ShellSection } from "./navigation";

/**
 * Moldura V2.
 *
 * A composição não descende do DocsNav: aquela era rail de siglas + painel +
 * conteúdo, com caixa e borda em quase tudo. Aqui são três zonas — barra,
 * navegação, conteúdo — e o conteúdo recebe a maior parte da área.
 *
 * O canvas entra recuado, sobre o fundo da moldura. O vão é estrutural, não
 * decorativo: é ele que garante o limite quando a marca é preta e a moldura
 * também é escura, ou quando a marca é branca. Um filete encostado numa cor
 * saturada vibra; um vão não.
 */
/**
 * Um elemento só recebe foco se estiver no documento, alcançável e com caixa.
 *
 * `isConnected` sozinho mente: o botão da navegação continua no documento e
 * some acima de 1024px. Focar algo sem caixa manda o foco para o corpo, que é
 * onde quem usa teclado perde a posição.
 */
function podeReceberFoco(el: HTMLElement | null): boolean {
  if (!el?.isConnected) return false;
  /*
   * O corpo do documento passava nesta checagem.
   *
   * `document.activeElement` é o `<body>` quando nada está focado, e é
   * exatamente esse o estado de quem abre a busca por ⌘K logo depois de
   * carregar a página. O corpo está conectado, não é inerte e tem caixa —
   * então ele era considerado focável, `body.focus()` era chamado, não fazia
   * nada, e a cadeia de reserva NUNCA rodava. Fechar a busca deixava o foco no
   * vazio, que é o defeito que a cadeia inteira existe para impedir.
   */
  if (el === document.body || el === document.documentElement) return false;
  if (el.closest("[inert]")) return false;
  return el.getClientRects().length > 0;
}

export function AppShellV2({
  sections,
  docs,
  userEmail,
  brandName,
  brandDescriptor,
  brandLanguage,
  statusLabels,
  sessionControl,
  basePath,
  contextoAtivo,
  children,
}: {
  sections: ShellSection[];
  docs: readonly DocPageEntry[];
  userEmail?: string;
  /** Contexto da marca ativa, resolvido pela requisição. A moldura o exibe
   *  como rótulo; nenhum componente daqui vai buscá-lo por conta própria. */
  brandName?: string;
  brandDescriptor?: string;
  /** Vocabulário editorial da marca. A paleta mostra o status das páginas, e
   *  esse rótulo é da marca — ver StatusBadge. */
  brandLanguage?: string;
  statusLabels?: StatusLabels;
  /** Sair da conta. Vive na barra, não numa faixa própria empilhada por cima
   *  da navegação — que era o que a V1 fazia. */
  sessionControl?: React.ReactNode;
  /** Prefixo alternativo para os destinos. Existe para a rota de comparação
   *  manter a navegação dentro da V2; em produção fica ausente e os destinos
   *  são os reais. String, não função: não atravessa a fronteira de servidor
   *  para cliente de outro jeito. */
  basePath?: string;
  /** Conta e marca em exibição, mais tudo que a pessoa alcança. Vem da
   *  requisição já resolvido; nenhum componente daqui consulta o banco. */
  contextoAtivo?: {
    workspaceSlug: string;
    brandKey: string;
    opcoes: readonly OpcaoDeContexto[];
  };
  children: React.ReactNode;
}) {
  /**
   * UM modal por vez, por construção.
   *
   * Eram dois booleanos independentes, e ⌘K funciona em qualquer lugar: com a
   * gaveta aberta, o atalho abria a busca por cima dela e a página passava a
   * ter dois diálogos, ambos declarando `aria-modal`. Dois estados que podem
   * ser verdadeiros ao mesmo tempo descrevem uma situação que não deveria
   * existir; um estado com três valores não a descreve.
   */
  const [modal, setModal] = useState<"none" | "nav" | "search">("none");

  const origemDoFoco = useRef<HTMLElement | null>(null);

  /** Guarda a origem ANTES de abrir: no instante em que o `inert` entra, o
   *  navegador já tirou o foco do elemento, e ele vira inalcançável. */
  const abrir = useCallback((qual: "nav" | "search") => {
    origemDoFoco.current ??= document.activeElement as HTMLElement | null;
    setModal(qual);
  }, []);

  const abrirBusca = useCallback(() => abrir("search"), [abrir]);
  const fechar = useCallback(() => setModal("none"), []);

  /**
   * De onde a pessoa veio, para onde ela volta.
   *
   * Cada modal tentava devolver o foco por conta própria, e isso não funciona
   * aqui por um motivo específico: enquanto há modal aberto, o resto da
   * aplicação está `inert`, e focar um elemento inerte não faz nada. Ao trocar
   * a gaveta pela busca, a gaveta devolvia o foco a um botão naquele instante
   * inerte — o foco caía no corpo do documento, e a busca, ao fechar, devolvia
   * para lá.
   *
   * Quem sabe quando o `inert` saiu é a moldura. Este efeito roda depois da
   * renderização que o removeu.
   */
  useEffect(() => {
    if (modal !== "none") return;

    const origem = origemDoFoco.current;
    // Sem origem não houve modal: este efeito também roda na montagem, e sem
    // esta saída a cadeia de reserva focava a navegação ou o conteúdo assim
    // que a página carregava. Restaurar foco e inicializar foco são coisas
    // diferentes — a segunda não é trabalho da moldura, e atropela a ordem
    // natural do teclado e o anúncio de um leitor de tela.
    if (!origem) return;

    origemDoFoco.current = null;

    // `isConnected` não basta: o botão da navegação continua no documento e
    // fica escondido acima de 1024px. Abrir a gaveta no celular, girar para
    // paisagem e fechar devolvia o foco a um elemento sem caixa — ou seja,
    // para o corpo do documento, e quem usa teclado perdia a posição.
    if (podeReceberFoco(origem)) {
      origem!.focus();
      return;
    }

    // A origem sumiu com a mudança de largura. O equivalente visível é o
    // destino ativo da navegação: é onde a pessoa estaria se tivesse chegado
    // até aqui pelo desktop.
    const ativo = document.querySelector<HTMLElement>("[data-nav-active]");
    if (podeReceberFoco(ativo)) {
      ativo!.focus();
      return;
    }

    // Último recurso: o conteúdo. Melhor que o corpo do documento, porque
    // dali a tabulação continua de onde a pessoa está olhando.
    document.querySelector<HTMLElement>("[data-shell-main]")?.focus();
  }, [modal]);

  /**
   * Os atalhos, e o sinal de que eles existem.
   *
   * O ouvinte é registrado num efeito: entre a moldura aparecer na tela e a
   * hidratação terminar, ⌘K não chega a lugar nenhum. É uma janela curta e
   * real — quem apertar nela não abre a busca, e nada avisa.
   *
   * `data-shell-ready` é publicado DEPOIS do registro, no mesmo efeito. Ele
   * existe para que quem espera pela moldura espere pela condição certa, em
   * vez de por um tempo arbitrário: um teste que insiste na tecla até
   * funcionar mede o escalonamento, e passa mesmo com o atalho quebrado se
   * insistir o bastante.
   */
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        abrirBusca();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    // Atributo no DOM, não estado do React: isto é sinal para fora, e um
    // `setState` aqui provocaria render em cascata para publicar algo que a
    // aplicação nem consome.
    //
    // O nó é copiado para uma variável: na limpeza, `raiz.current` já pode
    // apontar para outro elemento — ou para nada —, e removeríamos o atributo
    // do lugar errado.
    const no = raiz.current;
    no?.setAttribute("data-shell-ready", "true");

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      no?.removeAttribute("data-shell-ready");
    };
  }, [abrirBusca]);

  // O destino carrega `foraDaMarca` até a busca: sem a marca, `withBase`
  // prefixaria "importar" com a marca ativa e o resultado da busca levaria a
  // um endereço que não existe.
  const destinations = sections.flatMap((section) =>
    section.destinations.map((d) => ({
      href: d.href,
      label: d.label,
      foraDaMarca: d.foraDaMarca,
    })),
  );

  const emModal = modal !== "none";
  /*
   * O botão da gaveta só existe se houver para onde ir.
   *
   * Contava também as páginas do manual, porque elas eram navegação: uma marca
   * sem utilidades contratadas tinha zero seções de moldura e cento e cinquenta
   * páginas, e contar só as seções esconderia a gaveta de quem mais precisava
   * dela. Agora a gaveta oferece apenas destinos da moldura — as seções saíram
   * dela, ver DesktopSidebar —, então contar páginas abriria uma gaveta que não
   * leva a nada. `docs` continua chegando aqui para a busca.
   */
  const temDestinos = sections.length > 0;

  return (
    <div ref={raiz} className="flex h-dvh flex-col bg-platform-bg text-platform-text">
      {/*
        `inert` desliga o resto da aplicação enquanto um modal está aberto.
        Prender o foco resolve a tabulação e não resolve a navegação virtual de
        um leitor de tela, que percorre a árvore inteira independente do foco:
        sem isto, quem usa leitor continua lendo e ativando o conteúdo coberto.
      */}
      <div className="flex min-h-0 flex-1 flex-col" inert={emModal}>
        <PlatformTopBar
          userEmail={userEmail}
          brandName={brandName}
          brandDescriptor={brandDescriptor}
          contextoAtivo={contextoAtivo}
          navigationOpen={modal === "nav"}
          onOpenSearch={abrirBusca}
          onOpenNavigation={temDestinos ? () => abrir("nav") : undefined}
        >
          {sessionControl}
        </PlatformTopBar>
        <div className="flex min-h-0 flex-1">
          <DesktopSidebar sections={sections} basePath={basePath} />
          {/* No mobile o vão estrutural some: 16px de cada lado de uma tela de
              390 é 8% da largura gasta em moldura. O canvas encosta e a borda
              some junto, porque filete em tela cheia não separa nada. */}
          <main
            data-shell-main
            /* Recebe o foco só quando não há para onde devolvê-lo. Não entra
               na ordem de tabulação: -1 aceita foco por programa, não por
               Tab. */
            tabIndex={-1}
            className="min-w-0 flex-1 overflow-y-auto p-0 pb-[env(safe-area-inset-bottom)] outline-none lg:p-[var(--space-shell-4)]"
          >
            {/*
             * `min-h-full`, não `h-full` — achado ao vivo (04/09): `h-full`
             * TRAVA a altura desta div na do `<main>` (a altura da tela). Com
             * `overflow-hidden` ao lado (aqui só para cortar o canto quadrado
             * do filho pela borda arredondada), qualquer página cujo
             * conteúdo passasse da tela ficava CORTADA em silêncio — sem
             * barra de rolagem, sem erro, o resto do manual simplesmente não
             * existia para quem lia. `min-h-full` preserva o cartão de altura
             * cheia em página curta (o motivo original do h-full) e ainda
             * assim deixa a div CRESCER com o conteúdo em página longa — e
             * aí `overflow-hidden` não corta mais nada, porque não sobra
             * nada fora da caixa para cortar. Quem rola de verdade é o
             * `<main>` ao redor, que já tinha `overflow-y-auto`.
             */}
            <div className="mx-auto min-h-full max-w-[1200px] overflow-hidden lg:rounded-[var(--radius-entry)] lg:border lg:border-platform-border">
              {children}
            </div>
          </main>
        </div>
      </div>

      <NavigationDrawer
        open={modal === "nav"}
        sections={sections}
        basePath={basePath}
        onClose={fechar}
      />

      {modal === "search" && (
        <CommandPalette
          docs={docs}
          destinations={destinations}
          basePath={basePath}
          brandLanguage={brandLanguage}
          statusLabels={statusLabels}
          onClose={fechar}
        />
      )}
    </div>
  );
}
