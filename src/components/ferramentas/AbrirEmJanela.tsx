"use client";

import { useEffect, useState } from "react";
import {
  ajustarATela, enderecoDaJanela, geometriaInicial, CHAVE_DO_ARMAZENAMENTO, lerGeometria, nomeDaJanela, recursosDaJanela,
  type FerramentaEmJanela,
} from "@/lib/ferramentas/janela";

/**
 * O botão "Abrir em janela" (21/10/2026): abre a ferramenta numa janela própria
 * do navegador, para a pessoa deixá-la ao lado do Illustrator, em outra tela, ou
 * abrir o Cores e o Grids ao mesmo tempo.
 *
 * Três cuidados:
 *   - o NOME da janela é fixo por ferramenta: abrir de novo traz a janela que já
 *     existe para a frente, em vez de empilhar outra igual. O endereço leva um
 *     `#`, que faz a navegação ser só de fragmento: a janela já aberta NÃO
 *     recarrega, e o trabalho que estava nela não se perde;
 *   - o tamanho e a posição da última vez são lembrados (neste computador) e
 *     ajustados à tela de hoje, para a janela nunca abrir fora de qualquer tela;
 *   - o botão só aparece onde faz sentido: tela larga e mouse. No celular, uma
 *     "janela" não existe.
 *
 * Abre só com um clique: o navegador bloqueia janela que ninguém pediu.
 */
export function AbrirEmJanela({ ferramenta }: { ferramenta: FerramentaEmJanela }) {
  const [cabe, setCabe] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    const consulta = window.matchMedia("(min-width: 900px) and (pointer: fine)");
    const atualizar = () => setCabe(consulta.matches);
    atualizar();
    consulta.addEventListener("change", atualizar);
    return () => consulta.removeEventListener("change", atualizar);
  }, []);

  if (!cabe) return null;

  function abrir() {
    const extras = screen as Screen & { availLeft?: number; availTop?: number };
    const tela = { largura: screen.availWidth, altura: screen.availHeight, esquerda: extras.availLeft ?? 0, topo: extras.availTop ?? 0 };
    let salva = null;
    try { salva = lerGeometria(localStorage.getItem(CHAVE_DO_ARMAZENAMENTO(ferramenta))); } catch { /* sem armazenamento: usa o padrão */ }
    const geometria = salva ? ajustarATela(salva, tela) : geometriaInicial(ferramenta, tela);
    const janela = window.open(`${enderecoDaJanela(ferramenta)}#janela`, nomeDaJanela(ferramenta), recursosDaJanela(geometria));
    if (!janela) {
      setAviso("O navegador bloqueou a janela. Permita pop-ups para este site e tente de novo.");
      return;
    }
    setAviso("");
    janela.focus();
  }

  return (
    <>
      <button
        type="button"
        data-abrir-em-janela
        onClick={abrir}
        className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-platform-border px-3 py-1.5 text-sm text-platform-text hover:border-platform-text"
      >
        <span aria-hidden className="font-mono text-[12px]">⧉</span>
        Abrir em janela
      </button>
      {aviso && <p role="alert" data-janela-aviso className="basis-full text-[12.5px] text-platform-danger sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-64 sm:text-right">{aviso}</p>}
    </>
  );
}
