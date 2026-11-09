"use client";

import { LimiteDeErro } from "@/components/shell/LimiteDeErro";

/**
 * A fronteira mais externa do contexto de marca.
 *
 * Ela pega o que falha ANTES do manual montar — resolução da marca, sessão,
 * carregamento dos documentos. Aqui a moldura ainda não existe, então a saída
 * segura é o resolvedor: mandar para o manual desta marca seria mandar de volta
 * para o que acabou de falhar.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <LimiteDeErro
      error={error}
      reset={reset}
      contexto="marca"
      titulo="Não foi possível abrir esta marca"
      tituloEn="Couldn't open this brand"
      descricao="A falha aconteceu antes do manual carregar. Suas outras marcas continuam acessíveis."
      descricaoEn="The failure happened before the manual loaded. Your other brands are still reachable."
      retorno={{
        href: "/docs",
        rotulo: "Escolher uma marca",
        rotuloEn: "Choose a brand",
      }}
    />
  );
}
