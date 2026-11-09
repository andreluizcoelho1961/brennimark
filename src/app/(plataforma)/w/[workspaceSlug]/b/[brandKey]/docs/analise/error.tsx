"use client";

import { LimiteDeErro } from "@/components/shell/LimiteDeErro";
import { useAlvo } from "@/platform/alvo-client";

/**
 * Falha na análise de peças.
 *
 * Mesma razão do chat, mais o histórico: quem vê uma tela de erro depois de
 * escolher um arquivo precisa saber se a peça subiu e se o histórico
 * sobreviveu.
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
      contexto="analise"
      titulo="A análise não pôde ser aberta"
      tituloEn="The review couldn't be opened"
      descricao="Nenhuma peça foi enviada e nada foi cobrado. O histórico anterior continua no lugar."
      descricaoEn="No piece was uploaded and nothing was charged. Your previous history is untouched."
      retorno={{
        href: `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs`,
        rotulo: "Voltar ao manual",
        rotuloEn: "Back to the manual",
      }}
    />
  );
}
