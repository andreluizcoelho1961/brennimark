"use client";

import { LimiteDeErro } from "@/components/shell/LimiteDeErro";
import { useAlvo } from "@/platform/alvo-client";

/**
 * Falha dentro do manual, fora das telas que têm fronteira própria.
 *
 * Dentro do layout: quem está lendo continua com a navegação e o seletor de
 * marca, e a falha fica contida na área de conteúdo em vez de derrubar a tela.
 */
export default function ErroNoManual({
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
      contexto="manual"
      titulo="Não foi possível abrir esta tela"
      tituloEn="Couldn't open this screen"
      descricao="O conteúdo não foi alterado. O resto do manual continua acessível pela navegação."
      descricaoEn="Nothing was changed. The rest of the manual is still reachable from the navigation."
      retorno={{
        href: `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs`,
        rotulo: "Voltar ao manual",
        rotuloEn: "Back to the manual",
      }}
    />
  );
}
