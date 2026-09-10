"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useIsEnglish } from "@/platform/locale-client";
import { prepararAmbienteDePdf } from "@/lib/import/stream-iteravel";
import {
  VIZINHAS,
  escalaParaLargura,
  janelaMontada,
} from "@/lib/documento-fonte/virtualizacao";
import { PaginaDoPdf } from "./PaginaDoPdf";

/** Passos de zoom. "Ajustar à largura" é estado, não um número desta lista. */
const PASSOS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

/** Respiro entre páginas, em pixels. Entra na tabela de deslocamentos. */
const ESPACO_ENTRE_PAGINAS = 24;

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
  origem,
  className,
}: {
  /** O identificador do DOCUMENTO. Nunca um caminho de Storage. */
  documentoId: string;
  contaSlug?: string;
  marcaChave?: string;
  /**
   * Endereço alternativo dos bytes, para a bancada e para a suíte de navegador.
   *
   * Existe porque a rota real exige sessão, conta e marca — corretamente — e a
   * suíte roda com autenticação desligada. Sem isto, o visualizador só seria
   * testável à mão, que é exatamente como os sete defeitos de hoje chegaram
   * até aqui.
   *
   * Quem passa este valor são as telas `/dev/*`, fechadas em produção.
   */
  origem?: string;
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
    if (origem) return origem;
    const params = new URLSearchParams();
    if (contaSlug) params.set("w", contaSlug);
    if (marcaChave) params.set("b", marcaChave);
    const consulta = params.toString();
    return `/api/documento-fonte/${documentoId}${consulta ? `?${consulta}` : ""}`;
  }, [documentoId, contaSlug, marcaChave, origem]);

  /** Carrega (ou recarrega) o documento, preservando a posição de leitura. */
  const carregar = useCallback(async () => {
    prepararAmbienteDePdf();
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    /**
     * O documento é carregado por TRANSPORTE DE INTERVALOS, e não por URL.
     *
     * ─── O que estava errado, e só produção mostrou ──────────────────────
     *
     * Passando `url`, o PDF.js faz uma primeira requisição **sem `Range`**:
     * ela existe para ler `Accept-Ranges` e `Content-Length` e decidir que
     * pode pedir intervalos, e o cliente aborta o corpo em seguida.
     *
     * Em localhost isso é inofensivo — o "servidor" está na mesma máquina e o
     * aborto chega antes de qualquer byte importar. Numa função da Vercel é
     * fatal: a rota começa a repassar o arquivo INTEIRO, e um manual de 4 MiB
     * atravessando uma função com teto de duração morre no meio. O PDF.js
     * recebe corpo truncado, tenta de novo, e o manual passa **sessenta
     * segundos sem abrir** — medido em produção, com o total de páginas
     * aparecendo como "—" porque o documento nunca carregou.
     *
     * ─── O que passa a acontecer ─────────────────────────────────────────
     *
     * Um `HEAD` traz o tamanho — resposta sem corpo, barata — e o
     * `PDFDataRangeTransport` pede pedaços. **Nenhuma requisição sem `Range`
     * chega à rota**, e é isso que o teste `nenhuma requisição sem Range`
     * tranca: é a invariante que protege produção, e não uma preferência.
     */
    const cabecalhos = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!cabecalhos.ok) {
      throw Object.assign(new Error("documento indisponível"), { status: cabecalhos.status });
    }
    const tamanho = Number(cabecalhos.headers.get("content-length"));
    if (!Number.isFinite(tamanho) || tamanho <= 0) {
      throw Object.assign(new Error("tamanho desconhecido"), { status: 502 });
    }

    const transporte = new pdfjs.PDFDataRangeTransport(tamanho, null, false);
    transporte.requestDataRange = (inicio: number, fim: number) => {
      /**
       * Preenche o intervalo pedido, inteiro, mesmo que a rota apare.
       *
       * A rota apara fatias acima do teto de 4 MiB — e devolve menos bytes do
       * que foram pedidos, dizendo a verdade no `Content-Range`. Entregar essa
       * fatia curta ao PDF.js o deixaria esperando o resto para sempre. O laço
       * continua de onde parou até completar o que foi pedido.
       */
      void (async () => {
        try {
          /**
           * O limite é o FIM DO ARQUIVO, não o fim pedido.
           *
           * O PDF.js pede intervalos que passam do fim — é legítimo, e o
           * servidor apara. A primeira versão deste laço somava os bytes
           * recebidos e, como nunca alcançava o fim pedido, pedia outra fatia
           * COMEÇANDO no fim do arquivo. A rota respondia `416`, o laço
           * desistia sem entregar nada, e o PDF.js esperava aquele pedaço para
           * sempre: o documento abria (47 páginas), e as páginas nunca
           * pintavam. Nenhum erro no console — só canvas preto.
           */
          const limite = Math.min(fim, tamanho);
          let cursor = inicio;
          const pedacos: Uint8Array[] = [];

          while (cursor < limite) {
            const resposta = await fetch(url, {
              headers: { Range: `bytes=${cursor}-${limite - 1}` },
              cache: "no-store",
            });
            if (resposta.status !== 206 && resposta.status !== 200) break;
            const parte = new Uint8Array(await resposta.arrayBuffer());
            // Resposta vazia não avança o cursor, e repetir seria laço infinito.
            if (parte.byteLength === 0) break;
            pedacos.push(parte);
            cursor += parte.byteLength;
          }

          if (pedacos.length === 0) return;
          const total = pedacos.reduce((a, p) => a + p.byteLength, 0);
          const junto = new Uint8Array(total);
          let posicao = 0;
          for (const p of pedacos) {
            junto.set(p, posicao);
            posicao += p.byteLength;
          }
          transporte.onDataRange(inicio, junto);
        } catch {
          // Abandono ou rede: o PDF.js trata a ausência do pedaço.
        }
      })();
    };

    const tarefa = pdfjs.getDocument({
      range: transporte,
      disableStream: true,
      disableAutoFetch: true,
      /**
       * 256 KiB por pedaço, e não os 64 KiB da sondagem original.
       *
       * A sondagem mediu bytes: 64 KiB de sufixo mais 64 KiB de início bastam
       * para abrir o documento, e isso continua verdade. O que ela não pesava
       * é o custo de cada IDA E VOLTA em produção — cada intervalo é uma
       * invocação de função serverless, com partida a frio, resolução de
       * sessão e consulta ao banco antes do primeiro byte.
       *
       * Um manual de 4 MiB pedia ~20 pedaços; com 256 KiB são ~13. Menos viagens
       * sem puxar quase o arquivo todo: 512 KiB transferia 77% dele. Continua
       * muito abaixo do teto de 4 MiB por fatia, e o número é ajustável agora que
       * `Server-Timing` dá a medida de produção.
       */
      rangeChunkSize: 262_144,
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

  /**
   * A largura da coluna decide o "ajustar à largura".
   *
   * MEDE DIRETO primeiro, e só depois observa. O `ResizeObserver` entrega por
   * frame de animação — e aba em segundo plano tem `requestAnimationFrame`
   * suspenso, então a primeira entrega pode nunca chegar. Sem ela a largura
   * ficava em zero, `escalaDe` caía no fallback de escala 1, e uma página de
   * 1920pt era desenhada com 1920px de canvas: quatro vezes os pixels
   * necessários, transbordando a coluna.
   *
   * Medir direto também evita o desenho duplo do caminho normal — antes, toda
   * abertura renderizava uma vez em escala 1 e outra na escala certa.
   */
  useEffect(() => {
    const coluna = colunaRef.current;
    if (!coluna) return;

    const medir = (largura: number) => {
      if (largura > 0) setLarguraDaColuna(largura);
    };

    medir(coluna.clientWidth);

    const observador = new ResizeObserver(([entrada]) => medir(entrada.contentRect.width));
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
  /**
   * A proporção a usar em página ainda não medida.
   *
   * Começa como A4 e passa a ser a da PRIMEIRA página medida. Um manual tem
   * páginas do mesmo tamanho quase sempre, então uma medida real acerta as
   * outras 999 — e o palpite fixo errava por ~129px em cada uma, que numa
   * navegação para a página 700 vira dezenas de milhares de pixels de deriva.
   * O sintoma não é sutil: a pessoa pede a página 700 e vê área vazia, porque
   * as páginas montadas ficaram muito abaixo da viewport.
   */
  const proporcaoPadrao = useMemo(() => {
    const primeira = dimensoes.values().next().value;
    return primeira && primeira.largura > 0 ? primeira.altura / primeira.largura : 1.414;
  }, [dimensoes]);

  /**
   * A tabela de deslocamentos: onde cada página COMEÇA, em pixels.
   *
   * Esta é a peça que faz a virtualização ser estável, e ela substituiu um
   * layout em fluxo que parecia funcionar e não funcionava. Em fluxo, montar
   * uma página troca uma moldura estimada por uma página real, a altura total
   * do documento muda, e TUDO abaixo se desloca — inclusive a posição para onde
   * a rolagem acabou de ir. O sintoma era pedir a página 700 e receber a 705,
   * sem erro nenhum: só a página errada na tela.
   *
   * Com as posições calculadas aqui e aplicadas de forma absoluta, montar e
   * desmontar não move mais nada. A rolagem passa a ser aritmética, e a página
   * atual sai de uma busca binária sobre este vetor — sem ler o DOM, sem
   * misturar `offsetTop` com `scrollTop`, que foi o segundo defeito da mesma
   * área.
   */
  const deslocamentos = useMemo(() => {
    const tabela = new Float64Array(total + 1);
    if (larguraDaColuna <= 0) return tabela;

    for (let n = 1; n <= total; n += 1) {
      const dimensao = dimensoes.get(n);
      const proporcao =
        dimensao && dimensao.largura > 0 ? dimensao.altura / dimensao.largura : proporcaoPadrao;
      tabela[n] = tabela[n - 1] + larguraDaColuna * proporcao + ESPACO_ENTRE_PAGINAS;
    }
    return tabela;
  }, [total, larguraDaColuna, dimensoes, proporcaoPadrao]);

  const alturaTotal = total > 0 ? deslocamentos[total] : 0;

  /** As páginas que existem no DOM agora. Fora dela, nada é montado. */
  const janela = useMemo(
    () => janelaMontada(paginaAtual, total, VIZINHAS),
    [paginaAtual, total],
  );

  const escalaDe = useCallback(
    (numero: number) => {
      if (ajuste.tipo === "fixo") return ajuste.escala;
      const dimensao = dimensoes.get(numero);
      if (!dimensao || larguraDaColuna <= 0) return 1;
      return escalaParaLargura(dimensao, larguraDaColuna);
    },
    [ajuste, dimensoes, larguraDaColuna],
  );

  /**
   * Qual página está sendo lida — aritmética pura sobre a tabela.
   *
   * Sem leitura de DOM: `getBoundingClientRect` num laço força o navegador a
   * recalcular layout, e a versão anterior fazia isso a cada quadro de rolagem.
   */
  useEffect(() => {
    const rolo = roloRef.current;
    if (!rolo || total === 0 || alturaTotal <= 0) return;

    let agendado = 0;
    const medir = () => {
      agendado = 0;
      const alvo = rolo.scrollTop + rolo.clientHeight * 0.3;

      let baixo = 1;
      let cima = total;
      let achado = 1;
      while (baixo <= cima) {
        const meio = (baixo + cima) >> 1;
        if (deslocamentos[meio - 1] <= alvo) {
          achado = meio;
          baixo = meio + 1;
        } else {
          cima = meio - 1;
        }
      }
      setPaginaAtual(achado);
    };

    const aoRolar = () => {
      // Uma medição por quadro: a rolagem dispara dezenas de eventos por
      // segundo, e medir em cada um é trabalho jogado fora.
      if (agendado === 0) agendado = requestAnimationFrame(medir);
    };

    rolo.addEventListener("scroll", aoRolar, { passive: true });
    medir();
    return () => {
      rolo.removeEventListener("scroll", aoRolar);
      if (agendado !== 0) cancelAnimationFrame(agendado);
    };
  }, [total, alturaTotal, deslocamentos]);

  const irPara = useCallback(
    (numero: number) => {
      const destino = Math.min(Math.max(Math.trunc(numero), 1), Math.max(total, 1));
      const rolo = roloRef.current;
      // A posição sai da tabela, não do DOM. Não há o que esperar montar, e
      // portanto não há correção posterior nem salto visível.
      if (rolo) rolo.scrollTop = deslocamentos[destino - 1];
      setPaginaAtual(destino);
    },
    [total, deslocamentos],
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
        /**
         * O ponto de partida é a escala EFETIVA, não o número 1.
         *
         * Defeito medido: vindo de "ajustar à largura", a escala real era ~1,8
         * e o "+" saltava para 1,25 — o botão de aumentar DIMINUÍA a página.
         * Partir do que está na tela é o que faz o passo seguinte ser para
         * cima.
         */
        const atual = antes.tipo === "fixo" ? antes.escala : escalaDe(paginaAtual);

        // Para cima, o primeiro passo ESTRITAMENTE maior; para baixo, o último
        // estritamente menor. Sem o "estritamente", o passo de descida devolvia
        // o próprio valor atual e o botão não fazia nada — medido.
        const proximo =
          direcao === 1
            ? (PASSOS.find((p) => p > atual + 0.001) ?? PASSOS[PASSOS.length - 1])
            : ([...PASSOS].reverse().find((p) => p < atual - 0.001) ?? PASSOS[0]);

        return { tipo: "fixo", escala: proximo };
      });
    },
    [escalaDe, paginaAtual],
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
            className="relative mx-auto max-w-[1100px] px-[var(--space-shell-3)] py-[var(--space-shell-4)]"
            style={{ height: alturaTotal > 0 ? `${alturaTotal}px` : undefined }}
          >
            {documento &&
              janela.map((numero) => {
                const dimensao = dimensoes.get(numero);
                const proporcao =
                  dimensao && dimensao.largura > 0
                    ? dimensao.altura / dimensao.largura
                    : proporcaoPadrao;
                return (
                  /**
                   * Posição ABSOLUTA, vinda da tabela.
                   *
                   * Só as páginas da janela existem no DOM — não há mil molduras
                   * vazias. O contêiner tem a altura total calculada, então a
                   * barra de rolagem representa o documento inteiro sem que
                   * nada precise ocupar espaço para isso.
                   */
                  <div
                    key={numero}
                    // Sem padding próprio: a coluna já tem o dela, e as duas
                    // somadas recuavam a página duas vezes — a escala vinha da
                    // largura da coluna e o espaço real era menor, o que
                    // produzia rolagem horizontal de alguns pixels.
                    className="absolute left-0 right-0"
                    style={{
                      top: `${deslocamentos[numero - 1]}px`,
                      height: `${larguraDaColuna * proporcao}px`,
                    }}
                  >
                    <PaginaDoPdf
                      documento={documento}
                      numero={numero}
                      escalaPedida={escalaDe(numero)}
                      montada
                      aoMedir={aoMedir}
                      termoBuscado={termo}
                      rotulo={t(`Página ${numero}`, `Page ${numero}`)}
                    />
                  </div>
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
   * O campo de página acompanha a rolagem, mas nunca atropela quem digita.
   *
   * Ele é não-controlado e atualizado por referência: enquanto o campo tem o
   * foco, a rolagem não o toca. Duas alternativas foram tentadas e são piores.
   * Sincronizar por efeito reescreve o que a pessoa está digitando a cada
   * página que passa. Remontar por `key` recria o elemento a cada mudança de
   * página — o foco cai no meio da digitação, e num documento de mil páginas
   * isso acontece a cada rolagem.
   */
  const campoRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const campo = campoRef.current;
    if (campo && document.activeElement !== campo) campo.value = String(paginaAtual);
  }, [paginaAtual]);

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
          const n = Number(campoRef.current?.value);
          if (Number.isFinite(n)) aoIrPara(n);
          campoRef.current?.blur();
        }}
        className="flex items-center gap-1 text-[13px]"
      >
        <label htmlFor="pagina-atual" className="sr-only">
          {t("Ir para a página", "Go to page")}
        </label>
        <input
          id="pagina-atual"
          ref={campoRef}
          defaultValue={String(paginaAtual)}
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
