"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useIsEnglish } from "@/platform/locale-client";
import { prepararAmbienteDePdf } from "@/lib/import/stream-iteravel";
import {
  VIZINHAS,
  dentroDaJanela,
  escalaParaLargura,
} from "@/lib/documento-fonte/virtualizacao";
import { PaginaDoPdf } from "./PaginaDoPdf";

/** Passos de zoom. "Ajustar à largura" é estado, não um número desta lista. */
const PASSOS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

type Ajuste = { tipo: "largura" } | { tipo: "fixo"; escala: number };

/**
 * O visualizador canônico: o PDF do cliente, como ele é.
 *
 * A moldura é da plataforma (`--platform-*`); o que está dentro do quadro
 * branco é o documento do cliente, e o produto não o toca. Nada aqui recorta,
 * reenquadra, recolore ou remonta a página — nem no telefone, onde a tentação
 * de "adaptar" é maior e onde remontar destruiria a diagramação que o manual
 * existe para transmitir.
 */
export function VisualizadorDePdf({
  documentoId,
  contaSlug,
  marcaChave,
  className,
}: {
  /** O identificador do DOCUMENTO. Nunca um caminho de Storage. */
  documentoId: string;
  contaSlug?: string;
  marcaChave?: string;
  className?: string;
}) {
  const [documento, setDocumento] = useState<PDFDocumentProxy | null>(null);
  const [total, setTotal] = useState(0);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [ajuste, setAjuste] = useState<Ajuste>({ tipo: "largura" });
  const [larguraDaColuna, setLarguraDaColuna] = useState(0);
  const [dimensoes, setDimensoes] = useState<Map<number, { largura: number; altura: number }>>(
    new Map(),
  );
  const [termo, setTermo] = useState("");
  const [falha, setFalha] = useState<string | null>(null);
  const [miniaturasAbertas, setMiniaturasAbertas] = useState(false);

  const isEnglish = useIsEnglish();
  const t = useCallback((pt: string, en: string) => (isEnglish ? en : pt), [isEnglish]);

  const roloRef = useRef<HTMLDivElement | null>(null);
  const colunaRef = useRef<HTMLDivElement | null>(null);
  /**
   * A posição sobrevive à troca de documento.
   *
   * Quando a credencial vence, o documento é recarregado — e sem isto a pessoa
   * voltaria à página 1 no meio da leitura, que é a forma mais visível de o
   * produto perder o trabalho de quem está usando.
   */
  const posicaoSalva = useRef<{ pagina: number; deslocamento: number } | null>(null);
  const tentativas = useRef(0);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (contaSlug) params.set("w", contaSlug);
    if (marcaChave) params.set("b", marcaChave);
    const consulta = params.toString();
    return `/api/documento-fonte/${documentoId}${consulta ? `?${consulta}` : ""}`;
  }, [documentoId, contaSlug, marcaChave]);

  /** Carrega (ou recarrega) o documento, preservando a posição de leitura. */
  const carregar = useCallback(async () => {
    prepararAmbienteDePdf();
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    /**
     * A configuração que faz a rota valer a pena.
     *
     * `disableStream` e `disableAutoFetch` impedem o PDF.js de puxar o arquivo
     * inteiro em segundo plano — sem os dois, ele pede intervalos E baixa tudo
     * mesmo assim, e a economia de banda que motivou a rota desaparece.
     *
     * `rangeChunkSize` em 64 KiB é o que a sondagem mediu: sufixo de 64 KiB
     * mais início de 64 KiB bastam para abrir o documento.
     */
    const tarefa = pdfjs.getDocument({
      url,
      disableStream: true,
      disableAutoFetch: true,
      rangeChunkSize: 65_536,
      withCredentials: true,
    });

    const doc = await tarefa.promise;
    setDocumento((anterior) => {
      // O documento anterior é destruído explicitamente: sem isto, recarregar
      // por credencial vencida acumula um documento inteiro a cada renovação.
      // Quem destrói é a TAREFA de carregamento, não o documento: ela é que
      // aborta as requisições de rede em curso e encerra o worker.
      void anterior?.loadingTask.destroy();
      return doc;
    });
    setTotal(doc.numPages);
    setFalha(null);
    tentativas.current = 0;
  }, [url]);

  useEffect(() => {
    let cancelado = false;

    async function abrir() {
      try {
        await carregar();
      } catch (erro: unknown) {
        if (cancelado) return;
        /**
         * A credencial vencida chega como 401 — a rota já traduziu o 400 que a
         * assinatura do Storage devolve, que nenhum cliente sabe interpretar.
         * Uma tentativa, não um laço: repetir para sempre contra um documento
         * que não existe é o que transforma erro em conta de banda.
         */
        const status = (erro as { status?: number })?.status;
        if (status === 401 && tentativas.current === 0) {
          tentativas.current += 1;
          try {
            await carregar();
          } catch {
            if (!cancelado) setFalha("expirada");
          }
          return;
        }
        setFalha(status === 404 ? "nao_encontrado" : "indisponivel");
      }
    }

    void abrir();
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  useEffect(() => {
    return () => {
      // Sair da tela com o manual aberto precisa encerrar o worker e abortar
      // os intervalos ainda em voo — senão a rota segue servindo bytes para
      // uma tela que já não existe.
      void documento?.loadingTask.destroy();
    };
  }, [documento]);

  /** A largura da coluna decide o "ajustar à largura", e ela muda com a janela. */
  useEffect(() => {
    const coluna = colunaRef.current;
    if (!coluna) return;
    const observador = new ResizeObserver(([entrada]) => {
      setLarguraDaColuna(entrada.contentRect.width);
    });
    observador.observe(coluna);
    return () => observador.disconnect();
  }, []);

  const aoMedir = useCallback((numero: number, largura: number, altura: number) => {
    setDimensoes((antes) => {
      if (antes.get(numero)?.largura === largura) return antes;
      const novo = new Map(antes);
      novo.set(numero, { largura, altura });
      return novo;
    });
  }, []);

  /**
   * A escala pedida.
   *
   * No modo "largura", ela é recalculada por página: um manual de identidade
   * mistura retrato e paisagem, e uma escala única deixaria as pranchas
   * estourando a coluna ou as páginas de texto minúsculas.
   */
  const escalaDe = useCallback(
    (numero: number) => {
      if (ajuste.tipo === "fixo") return ajuste.escala;
      const dimensao = dimensoes.get(numero);
      if (!dimensao || larguraDaColuna <= 0) return 1;
      return escalaParaLargura(dimensao, larguraDaColuna);
    },
    [ajuste, dimensoes, larguraDaColuna],
  );

  /** Qual página está sendo lida: a que ocupa o meio da janela de rolagem. */
  useEffect(() => {
    const rolo = roloRef.current;
    if (!rolo || total === 0) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visivel) return;
        const numero = Number((visivel.target as HTMLElement).dataset.pagina);
        if (Number.isFinite(numero) && numero > 0) setPaginaAtual(numero);
      },
      { root: rolo, threshold: [0.1, 0.5, 0.9] },
    );

    for (const moldura of rolo.querySelectorAll("[data-pagina]")) {
      observador.observe(moldura);
    }
    return () => observador.disconnect();
  }, [total, larguraDaColuna]);

  const irPara = useCallback(
    (numero: number) => {
      const destino = Math.min(Math.max(Math.trunc(numero), 1), Math.max(total, 1));
      const alvo = roloRef.current?.querySelector(`[data-pagina="${destino}"]`);
      alvo?.scrollIntoView({ block: "start" });
      setPaginaAtual(destino);
    },
    [total],
  );

  /**
   * Links internos do PDF.
   *
   * Um manual de 743 páginas tem sumário clicável, e um sumário que não leva a
   * lugar nenhum é pior que sumário nenhum: parece defeito do documento do
   * cliente, não do nosso visualizador.
   */
  useEffect(() => {
    if (!documento) return;
    const rolo = roloRef.current;
    if (!rolo) return;

    const aoClicar = async (evento: MouseEvent) => {
      const alvo = (evento.target as HTMLElement).closest("a[href^='#']");
      if (!alvo) return;
      const destino = decodeURIComponent(alvo.getAttribute("href")!.slice(1));
      try {
        const explicito = await documento.getDestination(destino);
        const referencia = explicito?.[0];
        if (!referencia) return;
        const indice = await documento.getPageIndex(referencia as never);
        evento.preventDefault();
        irPara(indice + 1);
      } catch {
        // Destino que não resolve não vira navegação para lugar nenhum: o
        // clique simplesmente não faz nada, e a página segue onde está.
      }
    };

    rolo.addEventListener("click", aoClicar);
    return () => rolo.removeEventListener("click", aoClicar);
  }, [documento, irPara]);

  const telaCheia = useCallback(() => {
    const alvo = roloRef.current?.parentElement;
    if (!alvo) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void alvo.requestFullscreen().catch(() => undefined);
  }, []);

  const zoom = useCallback(
    (direcao: 1 | -1) => {
      setAjuste((antes) => {
        const atual = antes.tipo === "fixo" ? antes.escala : 1;
        const indice = PASSOS.findIndex((p) => p >= atual - 0.001);
        const proximo = PASSOS[Math.min(Math.max(indice + direcao, 0), PASSOS.length - 1)];
        return { tipo: "fixo", escala: proximo };
      });
    },
    [],
  );

  // Guarda a posição a cada mudança, para a retomada depois de recarregar.
  useEffect(() => {
    posicaoSalva.current = { pagina: paginaAtual, deslocamento: roloRef.current?.scrollTop ?? 0 };
  }, [paginaAtual]);

  /**
   * A retomada, quando o documento é trocado.
   *
   * `irPara` vive num ref para que este efeito dependa SÓ do documento. Sem
   * isso ele voltaria a rodar a cada mudança de total ou de escala, e a leitura
   * saltaria de volta para a página salva enquanto a pessoa rola.
   */
  const irParaRef = useRef(irPara);
  useEffect(() => {
    irParaRef.current = irPara;
  }, [irPara]);

  useEffect(() => {
    if (!documento) return;
    const salva = posicaoSalva.current;
    if (salva && salva.pagina > 1) irParaRef.current(salva.pagina);
  }, [documento]);

  if (falha) {
    return (
      <div className={className}>
        <p className="rounded-lg border border-platform-border bg-platform-panel p-[var(--space-shell-4)] text-[14px] text-platform-text">
          {falha === "nao_encontrado"
            ? t(
                "Este documento não está disponível nesta marca.",
                "This document isn't available for this brand.",
              )
            : t(
                "Não foi possível abrir o manual agora. Tente de novo em instantes.",
                "Couldn't open the manual right now. Try again in a moment.",
              )}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col bg-platform-bg ${className ?? ""}`}>
      <Barra
        t={t}
        paginaAtual={paginaAtual}
        total={total}
        ajuste={ajuste}
        termo={termo}
        miniaturasAbertas={miniaturasAbertas}
        aoIrPara={irPara}
        aoZoom={zoom}
        aoAjustarLargura={() => setAjuste({ tipo: "largura" })}
        aoBuscar={setTermo}
        aoTelaCheia={telaCheia}
        aoAlternarMiniaturas={() => setMiniaturasAbertas((v) => !v)}
      />

      <div className="flex min-h-0 flex-1">
        {miniaturasAbertas && documento && (
          <Miniaturas
            t={t}
            documento={documento}
            total={total}
            paginaAtual={paginaAtual}
            aoEscolher={irPara}
          />
        )}

        <div ref={roloRef} className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <div
            ref={colunaRef}
            className="mx-auto flex max-w-[1100px] flex-col gap-[var(--space-shell-4)] px-[var(--space-shell-3)] py-[var(--space-shell-4)]"
          >
            {documento &&
              Array.from({ length: total }, (_, i) => i + 1).map((numero) => {
                const montada = dentroDaJanela(numero, paginaAtual, total, VIZINHAS);
                const dimensao = dimensoes.get(numero);
                const escala = escalaDe(numero);
                return montada ? (
                  <PaginaDoPdf
                    key={numero}
                    documento={documento}
                    numero={numero}
                    escalaPedida={escala}
                    montada
                    aoMedir={aoMedir}
                    termoBuscado={termo}
                    rotulo={t(`Página ${numero}`, `Page ${numero}`)}
                  />
                ) : (
                  /**
                   * Fora da janela, a página vira só o espaço que ocupa.
                   *
                   * Ela PRECISA ocupar o espaço certo: sem isso a barra de
                   * rolagem encolhe e cresce a cada montagem, e a página salta
                   * sob o dedo de quem lê. A altura vem da medida real quando
                   * já foi vista; antes disso, da proporção A4, que é o palpite
                   * menos errado para um manual.
                   */
                  <div
                    key={numero}
                    data-pagina={numero}
                    aria-hidden
                    className="mx-auto w-full bg-platform-panel-muted"
                    style={{
                      height: dimensao
                        ? `${dimensao.altura * escala}px`
                        : `${larguraDaColuna * 1.414}px`,
                    }}
                  />
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Barra({
  t,
  paginaAtual,
  total,
  ajuste,
  termo,
  miniaturasAbertas,
  aoIrPara,
  aoZoom,
  aoAjustarLargura,
  aoBuscar,
  aoTelaCheia,
  aoAlternarMiniaturas,
}: {
  t: (pt: string, en: string) => string;
  paginaAtual: number;
  total: number;
  ajuste: Ajuste;
  termo: string;
  miniaturasAbertas: boolean;
  aoIrPara: (n: number) => void;
  aoZoom: (d: 1 | -1) => void;
  aoAjustarLargura: () => void;
  aoBuscar: (t: string) => void;
  aoTelaCheia: () => void;
  aoAlternarMiniaturas: () => void;
}) {
  /**
   * O campo é remontado pela `key` quando a página muda, em vez de
   * sincronizado por efeito. Sincronizar por efeito reescreveria o que a pessoa
   * está digitando toda vez que a rolagem passa por uma página nova — o campo
   * brigaria com o dedo dela.
   */
  const [campo, setCampo] = useState(String(paginaAtual));

  return (
    /**
     * A barra é da PLATAFORMA: só tokens `--platform-*`.
     *
     * Nenhum controle pode herdar cor ou fonte da marca do cliente — um manual
     * de fundo preto e um de fundo bege precisam da mesma moldura, e o
     * `leak-guard` verifica isso no código-fonte.
     */
    <div className="flex flex-wrap items-center gap-[var(--space-shell-3)] border-b border-platform-border bg-platform-panel px-[var(--space-shell-3)] py-[var(--space-shell-2)] text-platform-text">
      <button
        type="button"
        onClick={aoAlternarMiniaturas}
        aria-pressed={miniaturasAbertas}
        className="rounded border border-platform-border px-2 py-1 text-[13px]"
      >
        {t("Miniaturas", "Thumbnails")}
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(campo);
          if (Number.isFinite(n)) aoIrPara(n);
        }}
        className="flex items-center gap-1 text-[13px]"
      >
        <label htmlFor="pagina-atual" className="sr-only">
          {t("Ir para a página", "Go to page")}
        </label>
        <input
          id="pagina-atual"
          key={paginaAtual}
          defaultValue={String(paginaAtual)}
          onChange={(e) => setCampo(e.target.value)}
          inputMode="numeric"
          className="w-14 rounded border border-platform-border bg-platform-bg px-2 py-1 text-center"
        />
        <span className="text-platform-text-muted">
          {t("de", "of")} {total || "—"}
        </span>
      </form>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => aoZoom(-1)}
          aria-label={t("Diminuir zoom", "Zoom out")}
          className="rounded border border-platform-border px-2 py-1 text-[13px]"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => aoZoom(1)}
          aria-label={t("Aumentar zoom", "Zoom in")}
          className="rounded border border-platform-border px-2 py-1 text-[13px]"
        >
          +
        </button>
        <button
          type="button"
          onClick={aoAjustarLargura}
          aria-pressed={ajuste.tipo === "largura"}
          className="rounded border border-platform-border px-2 py-1 text-[13px]"
        >
          {t("Ajustar à largura", "Fit to width")}
        </button>
      </div>

      <label className="flex items-center gap-1 text-[13px]">
        <span className="sr-only">{t("Buscar no manual", "Search the manual")}</span>
        <input
          value={termo}
          onChange={(e) => aoBuscar(e.target.value)}
          placeholder={t("Buscar", "Search")}
          className="w-40 rounded border border-platform-border bg-platform-bg px-2 py-1"
        />
      </label>

      <button
        type="button"
        onClick={aoTelaCheia}
        className="ml-auto rounded border border-platform-border px-2 py-1 text-[13px]"
      >
        {t("Tela cheia", "Full screen")}
      </button>
    </div>
  );
}

/**
 * As miniaturas.
 *
 * Elas têm o mesmo problema de memória das páginas, em escala menor — e por
 * isso a mesma regra: só as próximas da atual são renderizadas, e a escala é
 * fixa e pequena.
 */
function Miniaturas({
  t,
  documento,
  total,
  paginaAtual,
  aoEscolher,
}: {
  t: (pt: string, en: string) => string;
  documento: PDFDocumentProxy;
  total: number;
  paginaAtual: number;
  aoEscolher: (n: number) => void;
}) {
  return (
    <nav
      aria-label={t("Miniaturas das páginas", "Page thumbnails")}
      className="w-[168px] shrink-0 overflow-auto border-r border-platform-border bg-platform-panel p-[var(--space-shell-2)]"
    >
      <ol className="flex flex-col gap-[var(--space-shell-2)]">
        {Array.from({ length: total }, (_, i) => i + 1).map((numero) => (
          <li key={numero}>
            <button
              type="button"
              onClick={() => aoEscolher(numero)}
              aria-current={numero === paginaAtual ? "true" : undefined}
              className="w-full rounded border border-platform-border bg-platform-bg p-1 text-[12px] text-platform-text-muted aria-[current]:border-platform-signal"
            >
              <PaginaDoPdf
                documento={documento}
                numero={numero}
                escalaPedida={0.2}
                montada={Math.abs(numero - paginaAtual) <= 6}
                rotulo={t(`Página ${numero}`, `Page ${numero}`)}
              />
              <span className="mt-1 block">{numero}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
