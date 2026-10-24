"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Uma captura REAL da plataforma, numa página do site (23/10/2026).
 *
 * Pedido do André: no lugar dos estudos de tela desenhados em código, o produto
 * de verdade. As capturas são da marca Brennimark (manual v0.3) em produção,
 * tiradas com densidade 2 (2880 × 1800) para ficar nítidas, e sem dado pessoal:
 * e-mails e nomes de quem usa viram nomes fictícios, e o endereço de um link de
 * entrega vira um exemplo.
 *
 * Ao toque (ou clique) a captura abre ampliada (24/10/2026): no celular, 390 px
 * de largura não deixam ler a tela da plataforma. O visor é maior que a janela e
 * rola em duas direções, então o texto fica legível. Ele sai pelo botão, por
 * Esc ou tocando no fundo.
 *
 * O visor é desenhado dentro de `.bm-site` (portal), e não em `body`: o CSS do
 * site é preso a essa raiz. E não no lugar de origem: ancestrais com `transform`
 * (a entrada dos blocos) prendem o `position: fixed` à caixa deles.
 */
export function Captura({ src, alt }: { src: StaticImageData; alt: string }) {
  const [aberta, setAberta] = useState(false);
  const [raiz, setRaiz] = useState<Element | null>(null);
  const abrir = useRef<HTMLButtonElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberta) return;
    const botao = abrir.current;
    const rolagem = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberta(false); };
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("keydown", tecla);
      document.documentElement.style.overflow = rolagem;
      botao?.focus();
    };
  }, [aberta]);

  useEffect(() => { if (aberta && raiz) fechar.current?.focus(); }, [aberta, raiz]);

  return (
    <div className="frame tela-real">
      <button type="button" ref={abrir} className="tela-real-img tela-real-abrir" style={{ aspectRatio: `${src.width} / ${src.height}` }}
        onClick={() => { setRaiz(document.querySelector(".bm-site")); setAberta(true); }} aria-label={`Ampliar a imagem: ${alt}`}>
        <Image src={src} alt="" sizes="(max-width: 1023px) 100vw, 55vw" />
        <span className="tela-real-lupa" aria-hidden="true">Ampliar</span>
      </button>
      {aberta && raiz && createPortal(
        <div className="visor" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setAberta(false)}>
          <button type="button" ref={fechar} className="visor-fechar" onClick={() => setAberta(false)}>Fechar</button>
          <div className="visor-rolagem">
            <Image src={src} alt={alt} sizes="1600px" className="visor-img" onClick={(e) => e.stopPropagation()} style={{ width: "max(100vw, 1100px)", height: "auto" }} />
          </div>
        </div>,
        raiz,
      )}
    </div>
  );
}
