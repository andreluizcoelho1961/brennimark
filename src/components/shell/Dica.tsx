"use client";

import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";

/**
 * A dica de um menu ou ferramenta — 15/10/2026, pedido do André.
 *
 * Aparece ao passar o mouse (depois de um instante, para não piscar quando o
 * cursor só atravessa) e na hora ao chegar pelo teclado; Esc fecha. Vai num
 * portal, com posição fixa: a coluna da esquerda corta o que sai dela
 * (`overflow`), e a dica precisa sair. O controle ganha `aria-describedby`,
 * para o leitor de tela ler a frase também.
 *
 * Tokens da PLATAFORMA (como a dica do Cores): nunca a cor da marca cliente.
 */
type Lado = "direita" | "baixo" | "cima";

const ATRASO_DO_MOUSE_MS = 300;

export function Dica({ titulo, texto, lado = "direita", ativa = true, children }: {
  titulo?: string;
  /** Desligada, não abre — mas o controle continua o MESMO elemento (trocar
   *  de árvore o recriaria, e o foco devolvido a ele se perderia). */
  ativa?: boolean;
  texto: string;
  lado?: Lado;
  children: ReactElement<Record<string, unknown>>;
}) {
  const id = useId();
  const ancora = useRef<HTMLSpanElement>(null);
  const espera = useRef<number | undefined>(undefined);
  const [posicao, setPosicao] = useState<{ x: number; y: number } | null>(null);
  const balao = useRef<HTMLSpanElement>(null);
  // Desloca a dica para dentro da janela quando ela sairia por uma borda (o
  // botão do Vini fica no canto: centrada nele, a dica saía pela direita).
  const [desvio, setDesvio] = useState(0);
  const MARGEM_DA_JANELA = 8;

  const abrir = (atraso: number) => {
    window.clearTimeout(espera.current);
    if (!ativa) return;
    espera.current = window.setTimeout(() => {
      const alvo = ancora.current?.firstElementChild;
      if (!alvo) return;
      const r = alvo.getBoundingClientRect();
      setDesvio(0);
      setPosicao(lado === "direita" ? { x: r.right + 10, y: r.top + r.height / 2 }
        : lado === "baixo" ? { x: r.left + r.width / 2, y: r.bottom + 8 }
        : { x: r.left + r.width / 2, y: r.top - 8 });
    }, atraso);
  };
  const fechar = () => {
    window.clearTimeout(espera.current);
    setPosicao(null);
  };

  useEffect(() => {
    if (!posicao) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    // Só a rolagem da PÁGINA fecha: a coluna, ao se abrir no hover, rola por
    // dentro e fechava a dica no mesmo instante.
    window.addEventListener("keydown", tecla);
    window.addEventListener("scroll", fechar);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", fechar);
    };
  }, [posicao]);
  useEffect(() => () => window.clearTimeout(espera.current), []);
  useLayoutEffect(() => {
    if (!posicao || !balao.current) { setDesvio(0); return; }
    const r = balao.current.getBoundingClientRect();
    const passaDireita = r.right - (window.innerWidth - MARGEM_DA_JANELA);
    const passaEsquerda = MARGEM_DA_JANELA - r.left;
    setDesvio(passaDireita > 0 ? -passaDireita : passaEsquerda > 0 ? passaEsquerda : 0);
  }, [posicao]);

  const transformacao = lado === "direita" ? "translateY(-50%)" : lado === "baixo" ? "translateX(-50%)" : "translate(-50%, -100%)";
  return (
    <span
      ref={ancora}
      className="contents"
      onMouseEnter={() => abrir(ATRASO_DO_MOUSE_MS)}
      onMouseLeave={fechar}
      onFocus={() => abrir(0)}
      onBlur={fechar}
      onClick={fechar}
    >
      {cloneElement(children, { "aria-describedby": posicao && ativa ? id : undefined })}
      {posicao && ativa && typeof document !== "undefined" && createPortal(
        <span
          id={id}
          role="tooltip"
          data-dica
          ref={balao}
          style={{ left: posicao.x + desvio, top: posicao.y, transform: transformacao }}
          className="pointer-events-none fixed z-[70] flex w-max max-w-[260px] flex-col gap-1 rounded-[var(--radius-control)] bg-platform-text px-3 py-2 text-left text-[12.5px] font-normal leading-snug text-platform-bg shadow-lg"
        >
          {titulo && <span className="font-semibold">{titulo}</span>}
          <span>{texto}</span>
        </span>,
        document.body,
      )}
    </span>
  );
}
