"use client";

import { useState, type ComponentProps } from "react";
import { VisualizadorDePdf } from "@/components/documento-fonte/VisualizadorDePdf";

/**
 * O visualizador com um botão que o TIRA da tela sem recarregar a página.
 *
 * É o gesto de trocar de tela dentro do produto: o React desmonta o
 * componente e a página continua viva. Recarregar a página esconderia o
 * defeito que esta bancada existe para provar — um carregamento que segue
 * correndo depois que a tela saiu —, porque recarregar mata tudo de uma vez.
 */
export function VisualizadorDesmontavel(props: ComponentProps<typeof VisualizadorDePdf>) {
  const [aberto, setAberto] = useState(true);
  return (
    <>
      <button type="button" data-fechar-visualizador onClick={() => setAberto(false)}
        className="self-start border border-platform-border px-3 py-1 text-[12px] text-platform-text">
        Fechar o visualizador
      </button>
      {aberto ? <VisualizadorDePdf {...props} /> : <p data-visualizador-fechado>Fechado.</p>}
    </>
  );
}
