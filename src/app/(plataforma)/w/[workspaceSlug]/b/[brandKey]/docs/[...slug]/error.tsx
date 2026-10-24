"use client";

import { LimiteDeErro } from "@/components/shell/LimiteDeErro";
import { useAlvo } from "@/platform/alvo-client";

/**
 * Falha ao renderizar UMA página do manual.
 *
 * Mais estreita que a de `/docs`, e por isso melhor: a moldura, a navegação e o
 * seletor de marca continuam montados, e a falha fica contida na área de
 * conteúdo. Quem estava lendo troca de página e segue.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const alvo = useAlvo();

  return (
    <LimiteDeErro
      error={error}
      reset={reset}
      contexto="documento"
      titulo="Não foi possível abrir esta página"
      tituloEn="Couldn't open this page"
      descricao="O conteúdo não foi alterado. O resto do manual continua acessível pela navegação ao lado."
      descricaoEn="Nothing was changed. The rest of the manual is still reachable from the navigation."
      retorno={{
        href: `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs`,
        rotulo: "Voltar ao manual",
        rotuloEn: "Back to the manual",
      }}
    />
  );
}
