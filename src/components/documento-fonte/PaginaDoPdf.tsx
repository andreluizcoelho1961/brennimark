"use client";

import { useEffect, useRef } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { escalaLimitada, tamanhoNaTela } from "@/lib/documento-fonte/virtualizacao";

/**
 * Uma página do manual, montada.
 *
 * As seis garantias estruturais de memória vivem no `useEffect` de baixo, e
 * cada uma existe porque a ausência dela derruba a aba num manual grande:
 *
 *  1. o render é cancelado quando a página sai da janela;
 *  2. `width` e `height` do canvas vão a zero antes de soltar o elemento —
 *     um canvas removido do DOM com dimensões preservadas continua ocupando
 *     memória de vídeo em vários navegadores;
 *  3. as referências do PDF.js (`PDFPageProxy`) são soltas explicitamente;
 *  4. nenhum cache de página renderizada além da janela;
 *  5. o teto é por pixels, não por multiplicador de zoom (`escalaLimitada`);
 *  6. nada é montado fora da janela — nem invisível, nem "só o placeholder
 *     com canvas dentro".
 *
 * `performance.memory` não vê buffer de canvas, então nada disto se prova em
 * emulador. O que se prova aqui é que a regra existe e roda.
 */
export function PaginaDoPdf({
  documento,
  numero,
  escalaPedida,
  montada,
  aoMedir,
  termoBuscado,
  rotulo,
}: {
  documento: PDFDocumentProxy;
  numero: number;
  /** Escala desejada; o teto de pixels pode entregar menos. */
  escalaPedida: number;
  /** Fora da janela de virtualização, a página vira só o espaço que ocupa. */
  montada: boolean;
  /** Informa as dimensões originais em pontos, para o pai calcular o ajuste. */
  aoMedir?: (numero: number, largura: number, altura: number) => void;
  termoBuscado?: string;
  /** Rótulo acessível já no idioma do produto; quem monta a tela decide. */
  rotulo?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textoRef = useRef<HTMLDivElement | null>(null);
  const molduraRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!montada) return;

    let vivo = true;
    let tarefa: RenderTask | null = null;
    let pagina: PDFPageProxy | null = null;

    const canvas = canvasRef.current;
    const camadaDeTexto = textoRef.current;
    if (!canvas) return;

    (async () => {
      pagina = await documento.getPage(numero);
      if (!vivo) return;

      /**
       * `rotation` não é passado: o padrão do `getViewport` já aplica o
       * `/Rotate` declarado pela própria página. Passar a nossa conta por cima
       * giraria duas vezes.
       */
      const base = pagina.getViewport({ scale: 1 });
      aoMedir?.(numero, base.width, base.height);

      // O teto de pixels age AQUI, e o resultado pode ser menor que o pedido.
      const escalaReal = escalaLimitada(
        { largura: base.width, altura: base.height },
        escalaPedida,
      );
      if (escalaReal <= 0) return;

      const viewport = pagina.getViewport({ scale: escalaReal });

      /**
       * A relação entre o canvas e o espaço na tela.
       *
       * Quando o teto reduz a escala, o canvas tem MENOS pixels que o espaço
       * que ocupa, e o navegador amplia — a página fica mais macia, e continua
       * inteira. A alternativa seria recortar, e recortar é o produto decidindo
       * o que da página do cliente merece ser visto.
       */
      const naTela = tamanhoNaTela({ largura: base.width, altura: base.height }, escalaPedida);

      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      canvas.style.width = `${naTela.largura}px`;
      canvas.style.height = `${naTela.altura}px`;

      const contexto = canvas.getContext("2d", { alpha: false });
      if (!contexto) return;

      tarefa = pagina.render({ canvas, canvasContext: contexto, viewport });
      try {
        await tarefa.promise;
      } catch (erro) {
        // `RenderingCancelledException` é o caminho ESPERADO de quem rola
        // rápido: a página saiu da janela antes de terminar. Não é falha, e
        // relatá-la encheria o console de ruído a cada rolagem.
        if (!vivo || (erro as { name?: string })?.name === "RenderingCancelledException") return;
        throw erro;
      }
      /*
       * Desenhada: o fundo branco da moldura sai. Ele existe para a folha
       * aparecer enquanto carrega; depois, com o canvas em tamanho fracionário
       * (1073,6 px), sobrava meio pixel de branco nas bordas — um filete claro
       * em volta de toda página escura (ensaio de 24/09, Sony Vaio).
       */
      if (vivo && molduraRef.current) molduraRef.current.dataset.desenhada = "sim";
      if (!vivo || !camadaDeTexto) return;

      /**
       * A camada de texto — e ela não é enfeite.
       *
       * Sem ela o canvas é opaco: leitor de tela não lê nada, ninguém
       * seleciona nem copia, e a busca do navegador não acha palavra alguma
       * num manual inteiro. É o que separa "imagem do manual" de "documento".
       *
       * `--scale-factor` é lida pelo CSS do PDF.js para posicionar cada trecho.
       * Sem ela o texto empilha no canto superior esquerdo.
       */
      camadaDeTexto.replaceChildren();
      camadaDeTexto.style.setProperty("--scale-factor", String(escalaPedida));
      camadaDeTexto.style.width = `${naTela.largura}px`;
      camadaDeTexto.style.height = `${naTela.altura}px`;

      const { TextLayer } = await import("pdfjs-dist");
      if (!vivo) return;

      const camada = new TextLayer({
        textContentSource: pagina.streamTextContent(),
        container: camadaDeTexto,
        viewport: pagina.getViewport({ scale: escalaPedida }),
      });
      await camada.render();
      if (!vivo) return;

      if (termoBuscado) destacar(camadaDeTexto, termoBuscado);
    })().catch(() => {
      /**
       * Uma página que falha ao renderizar não pode derrubar o documento.
       *
       * A moldura dela continua ocupando o lugar, com a proporção certa, e as
       * outras 742 páginas seguem legíveis. Sumir com a página seria a mesma
       * classe de erro que a importação cometia.
       */
      if (vivo && molduraRef.current) molduraRef.current.dataset.falhou = "sim";
    });

    return () => {
      vivo = false;
      // (1) cancelar o render em curso
      tarefa?.cancel();
      // (2) zerar o canvas ANTES de soltá-lo
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      // (3) soltar as referências do PDF.js
      pagina?.cleanup();
      pagina = null;
      camadaDeTexto?.replaceChildren();
    };
  }, [documento, numero, escalaPedida, montada, aoMedir, termoBuscado]);

  return (
    /**
     * `section`, e NÃO `role="img"`.
     *
     * `role="img"` faria a tecnologia assistiva tratar a página inteira como
     * uma imagem só e ignorar tudo dentro dela — inclusive a camada de texto,
     * que é justamente o que torna o manual legível para quem usa leitor de
     * tela. O rótulo nomeia a região; o conteúdo dela continua sendo lido.
     */
    /*
     * `w-fit`: a moldura branca tem a largura do CANVAS, e não da coluna.
     *
     * Defeito do ensaio de 18/09, medido em 23/09: sem isto a seção esticava à
     * largura da coluna COM o recuo (961 px), o canvas tinha a largura SEM ele
     * (937 px) e ficava encostado à esquerda — 24 px de fundo branco à direita
     * de toda página. Em página clara, invisível; na Sony Vaio, de fundo azul-
     * -marinho, uma faixa branca na borda que parecia ser do documento.
     */
    <section
      ref={molduraRef}
      data-pagina={numero}
      className="relative mx-auto w-fit bg-white shadow-[0_1px_12px_rgba(0,0,0,0.45)] data-[desenhada=sim]:bg-transparent data-[falhou=sim]:outline data-[falhou=sim]:outline-platform-warning"
      aria-label={rotulo ?? `${numero}`}
    >
      {/* `block` remove o espaço de linha-base que um canvas inline herda e que
          apareceria como uma faixa branca no rodapé de toda página. */}
      <canvas ref={canvasRef} className="block" />
      <div
        ref={textoRef}
        className="textLayer absolute inset-0"
        // A camada cobre o canvas para receber a seleção; o `select-text` é o
        // que faz o cursor de texto aparecer sobre a página.
        style={{ pointerEvents: "auto" }}
      />
    </section>
  );
}

/**
 * Marca as ocorrências do termo dentro da camada de texto já renderizada.
 *
 * Trabalha sobre o DOM que o PDF.js produziu, e não sobre o texto extraído por
 * nós, porque o destaque precisa cair exatamente onde o trecho está na página.
 */
function destacar(camada: HTMLElement, termo: string) {
  const alvo = termo.trim().toLowerCase();
  if (!alvo) return;

  for (const trecho of Array.from(camada.querySelectorAll<HTMLElement>("span"))) {
    const texto = trecho.textContent ?? "";
    if (texto.toLowerCase().includes(alvo)) trecho.dataset.achado = "sim";
  }
}
