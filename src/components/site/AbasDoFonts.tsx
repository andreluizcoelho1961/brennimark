"use client";

import Image, { type StaticImageData } from "next/image";
import { useState } from "react";

type Aba = { id: string; rotulo: string; legenda: string; alt: string; imagem: StaticImageData };

/** Troca entre as capturas reais do Fonts. Sem JavaScript, a primeira fica à mostra. */
export function AbasDoFonts({ abas, aria }: { abas: Aba[]; aria: string }) {
  const [atual, setAtual] = useState(0);
  const a = abas[atual];
  return (
    <div className="fx-janela" role="group" aria-label={aria}>
      <div className="frame">
        <Image src={a.imagem} alt={a.alt} sizes="(min-width: 1100px) 600px, 92vw" className="fx-captura" quality={90} priority={atual === 0} />
      </div>
      <div className="fx-abas" role="tablist">
        {abas.map((b, i) => (
          <button key={b.id} type="button" role="tab" aria-selected={i === atual} onClick={() => setAtual(i)}>{b.rotulo}</button>
        ))}
      </div>
      <p className="fx-legenda" aria-live="polite">{a.legenda}</p>
    </div>
  );
}
