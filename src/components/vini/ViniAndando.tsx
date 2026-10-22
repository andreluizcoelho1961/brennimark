"use client";

import { useEffect, useRef, useState } from "react";
import vini from "@/components/site/imagens/vini.webp";

/**
 * O Vini em pessoa, pequeno, em cima da janela de perguntas (22/10/2026,
 * pedido do André): anda de um lado para o outro na borda de cima, para em
 * pontos ao acaso e, parado, gesticula — é o mesmo vídeo do site.
 *
 * O vídeo não tem ciclo de passos; a caminhada é sugerida pelo deslocamento,
 * por um balanço curto e pelo corpo virado para onde vai.
 *
 * Só existe com a janela aberta, então o vídeo (340 KB) só carrega quando a
 * pessoa chama o Vini. Com "reduzir movimento", fica parado no quadro do pôster.
 * Decorativo: `aria-hidden`, sem clique, não cobre nada da janela.
 */
const SAFARI = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i;

/** Pixels por segundo andando, e quanto ele fica parado entre um passeio e outro. */
const VELOCIDADE = 38;
const PARADO_MIN_MS = 1800;
const PARADO_MAX_MS = 4800;

export function ViniAndando() {
  const trilho = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  // Posição em px a partir da esquerda do trilho; o lado para onde olha.
  const [x, setX] = useState<number | null>(null);
  const [duracao, setDuracao] = useState(0);
  const [olhaParaEsquerda, setOlhaParaEsquerda] = useState(false);
  const [andando, setAndando] = useState(false);

  useEffect(() => {
    const el = video.current;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || reduzido) return;
    // Safari não desenha a transparência do VP9; o HEVC com alfa é o dele.
    el.src = SAFARI.test(navigator.userAgent) ? "/site/vini.mov" : "/site/vini.webm";
    el.play().catch(() => {});
  }, []);

  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    const largura = () => Math.max(0, el.clientWidth - 56);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setX(largura() - 24);
      return;
    }
    let atual = largura() - 24;
    setX(atual);
    let espera = 0;
    const passear = () => {
      const destino = Math.round(Math.random() * largura());
      const distancia = Math.abs(destino - atual);
      if (distancia < 40) { espera = window.setTimeout(passear, 600); return; }
      const ms = (distancia / VELOCIDADE) * 1000;
      setOlhaParaEsquerda(destino < atual);
      setDuracao(ms);
      setAndando(true);
      setX(destino);
      atual = destino;
      espera = window.setTimeout(() => {
        setAndando(false);
        espera = window.setTimeout(passear, PARADO_MIN_MS + Math.random() * (PARADO_MAX_MS - PARADO_MIN_MS));
      }, ms);
    };
    espera = window.setTimeout(passear, 1200);
    return () => window.clearTimeout(espera);
  }, []);

  return (
    <div ref={trilho} data-vini-andando aria-hidden="true" className="pointer-events-none absolute inset-x-3 bottom-full h-16">
      <div
        className="absolute bottom-0 h-16 w-12"
        style={{ transform: `translateX(${x ?? 0}px)`, transition: `transform ${duracao}ms linear`, opacity: x === null ? 0 : 1 }}
      >
        <div data-andando={andando ? "" : undefined} className="vini-passo h-full w-full">
          <video
            ref={video}
            poster={vini.src}
            muted
            loop
            playsInline
            preload="none"
            className="h-full w-full object-contain object-bottom"
            style={{ transform: olhaParaEsquerda ? "scaleX(-1)" : undefined }}
          />
        </div>
      </div>
    </div>
  );
}
