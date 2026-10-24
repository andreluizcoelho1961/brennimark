"use client";

import { LimiteDeErro } from "@/components/shell/LimiteDeErro";

/**
 * Falha fora do contexto de marca: login, cadastro, resolvedor.
 *
 * A mais externa das fronteiras com layout. Ela ocupa a tela inteira porque
 * aqui não há moldura montada para preservar.
 */
export default function ErroDaAplicacao({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-platform-bg">
      <div className="w-full max-w-[38rem]">
        <LimiteDeErro
          error={error}
          reset={reset}
          contexto="aplicacao"
          titulo="Algo falhou aqui"
          tituloEn="Something failed here"
          descricao="Nada foi alterado. Tente de novo, ou volte para escolher uma marca."
          descricaoEn="Nothing was changed. Try again, or go back to choose a brand."
          retorno={{ href: "/docs", rotulo: "Escolher uma marca", rotuloEn: "Choose a brand" }}
        />
      </div>
    </main>
  );
}
