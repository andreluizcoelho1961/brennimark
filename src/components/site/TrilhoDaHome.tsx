"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CAPITULOS_DA_HOME } from "@/lib/site/paginas";

/**
 * O trilho horizontal da home: um capítulo por tela, rolagem com encaixe, e a
 * barra de baixo com o número, o nome e os pontos de cada capítulo.
 *
 * No computador, a roda do mouse que chega ao fim de um capítulo passa ao
 * próximo; as setas, PageUp/PageDown, Home e End também navegam. No celular o
 * trilho vira uma coluna comum, e a barra some (é o CSS que decide).
 *
 * O capítulo atual vai para o endereço (`/#planos`): recarregar, ou mandar o
 * link a alguém, abre no mesmo capítulo.
 *
 * O selo de demonstração sai de cena nos capítulos que já têm o próprio
 * chamado (início, planos, demonstração) e no "Num só lugar", onde cobriria as
 * abas: a classe `stamp-off-home` na raiz.
 */
const SEM_SELO = new Set<string>(["inicio", "num-so-lugar", "planos", "demonstracao"]);
const doisDigitos = (n: number) => String(n).padStart(2, "0");

export function TrilhoDaHome({ children }: { children: ReactNode }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);
  const irPara = useRef<(i: number, empilhar?: boolean) => void>(() => {});
  const total = CAPITULOS_DA_HOME.length;

  useEffect(() => {
    const track = trilho.current;
    const raiz = track?.closest<HTMLElement>(".bm-site");
    if (!track || !raiz) return;
    const paineis = [...track.querySelectorAll<HTMLElement>(".panel")];
    const celular = window.matchMedia("(max-width: 767px)");
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fim = new AbortController();
    const { signal } = fim;
    let cur = 0;
    let trava = false;
    let assentar = 0;

    /** O que o capítulo muda fora da barra: o painel ativo e o selo. */
    const aplicar = (i: number) => {
      cur = i;
      paineis.forEach((p, k) => p.classList.toggle("is-active", k === i));
      raiz.classList.toggle("stamp-off-home", SEM_SELO.has(paineis[i].id));
    };
    const marcar = (i: number) => {
      aplicar(i);
      setAtual(i);
    };
    const lembrar = (i: number, empilhar: boolean) => {
      const hash = `#${paineis[i].id}`;
      if (location.hash === hash) return;
      try {
        if (empilhar) history.pushState(history.state, "", hash);
        else history.replaceState(history.state, "", hash);
      } catch {
        // Endereço inalterado não impede o trilho de andar.
      }
    };
    const ir = (i: number, empilhar = true) => {
      const alvo = Math.max(0, Math.min(paineis.length - 1, i));
      const comportamento: ScrollBehavior = reduzido.matches ? "auto" : "smooth";
      if (celular.matches) paineis[alvo].scrollIntoView({ behavior: comportamento, block: "start" });
      else track.scrollTo({ left: alvo * track.clientWidth, behavior: comportamento });
      marcar(alvo);
      lembrar(alvo, empilhar);
    };
    irPara.current = ir;
    const indice = (id: string) => paineis.findIndex((p) => p.id === id);
    const pular = (i: number) => {
      requestAnimationFrame(() => {
        if (celular.matches) paineis[i].scrollIntoView({ block: "start" });
        else track.scrollLeft = i * track.clientWidth;
        marcar(i);
      });
    };

    // Rolar à mão: quando o encaixe assenta, o capítulo é o que ficou na tela.
    track.addEventListener(
      "scroll",
      () => {
        if (celular.matches) return;
        window.clearTimeout(assentar);
        assentar = window.setTimeout(() => {
          const i = Math.round(track.scrollLeft / track.clientWidth);
          if (i !== cur) {
            marcar(i);
            lembrar(i, true);
          }
        }, 120);
      },
      { passive: true, signal },
    );

    // Roda do mouse: rola o capítulo por dentro; no fim dele, passa ao próximo.
    track.addEventListener(
      "wheel",
      (e) => {
        if (celular.matches) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        const p = paineis[cur];
        const descendo = e.deltaY > 0;
        const cabe = descendo ? p.scrollTop + p.clientHeight < p.scrollHeight - 2 : p.scrollTop > 0;
        if (cabe) return;
        e.preventDefault();
        if (trava || Math.abs(e.deltaY) < 4) return;
        trava = true;
        ir(cur + (descendo ? 1 : -1));
        window.setTimeout(() => (trava = false), 650);
      },
      { passive: false, signal },
    );

    document.addEventListener(
      "keydown",
      (e) => {
        if (document.querySelector("dialog[open]") || celular.matches) return;
        const alvo = e.target as HTMLElement;
        const tag = alvo.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || alvo.getAttribute?.("role") === "tab") return;
        const teclas: Record<string, number> = {
          ArrowRight: cur + 1,
          PageDown: cur + 1,
          ArrowLeft: cur - 1,
          PageUp: cur - 1,
          Home: 0,
          End: paineis.length - 1,
        };
        if (!(e.key in teclas)) return;
        e.preventDefault();
        ir(teclas[e.key]);
      },
      { signal },
    );

    // Links para um capítulo (`data-go`): na home, o trilho desliza em vez de
    // recarregar. Na captura, para chegar antes de qualquer outro clique.
    document.addEventListener(
      "click",
      (e) => {
        const link = (e.target as Element).closest<HTMLElement>("[data-go]");
        if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
        const i = indice(link.dataset.go ?? "");
        if (i < 0) return;
        e.preventDefault();
        ir(i);
      },
      { capture: true, signal },
    );

    const peloEndereco = () => {
      const i = indice(location.hash.slice(1));
      if (i >= 0) pular(i);
    };
    window.addEventListener("hashchange", peloEndereco, { signal });
    window.addEventListener("popstate", peloEndereco, { signal });
    window.addEventListener("resize", () => !celular.matches && (track.scrollLeft = cur * track.clientWidth), { signal });

    // No celular o trilho é uma coluna: o capítulo é o que cruza o meio da tela.
    // A largura é lida A CADA aviso, e não uma vez na montagem: quem abre numa
    // janela estreita e depois a alarga (ou gira o tablet) ficava com o
    // observador da coluna ligado sobre o trilho horizontal, e o capítulo
    // mudava sozinho. O protótipo tinha o mesmo defeito.
    const observador = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((en) => {
          if (!celular.matches || !en.isIntersecting) return;
          const i = paineis.indexOf(en.target as HTMLElement);
          marcar(i);
          lembrar(i, false);
        }),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    paineis.forEach((p) => observador.observe(p));

    // Ao trocar de forma, o trilho volta ao capítulo em que a pessoa estava.
    celular.addEventListener("change", () => pular(cur), { signal });

    // Chegada: o capítulo do endereço, ou o primeiro.
    const inicial = indice(location.hash.slice(1));
    // O primeiro já sai do servidor como atual; só o painel e o selo precisam de confirmação.
    if (inicial > 0) pular(inicial);
    else aplicar(0);

    return () => {
      fim.abort();
      observador.disconnect();
      window.clearTimeout(assentar);
      irPara.current = () => {};
    };
  }, []);

  return (
    <>
      <main className="shell">
        <div className="track" id="track" ref={trilho}>
          {children}
        </div>
      </main>
      <nav className="chapnav" aria-label="Capítulos">
        <div className="chap-status" aria-live="polite">
          <b id="chap-n">
            {doisDigitos(atual + 1)} / {doisDigitos(total)}
          </b>
          <span id="chap-t">{CAPITULOS_DA_HOME[atual].titulo}</span>
        </div>
        <div className="dots" id="dots">
          {CAPITULOS_DA_HOME.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className="dot"
              aria-label={`Capítulo ${i + 1}: ${c.titulo}`}
              aria-current={i === atual ? "true" : "false"}
              onClick={() => irPara.current(i)}
            />
          ))}
        </div>
        <div className="chap-ctrl">
          <button type="button" id="prev" aria-label="Capítulo anterior" disabled={atual === 0} onClick={() => irPara.current(atual - 1)}>
            ←
          </button>
          <button
            type="button"
            id="next"
            aria-label="Próximo capítulo"
            disabled={atual === total - 1}
            onClick={() => irPara.current(atual + 1)}
          >
            →
          </button>
        </div>
      </nav>
    </>
  );
}
