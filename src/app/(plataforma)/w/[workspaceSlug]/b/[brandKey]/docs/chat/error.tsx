"use client";

import { LimiteDeErro } from "@/components/shell/LimiteDeErro";
import { useAlvo } from "@/platform/alvo-client";

/**
 * Falha no assistente.
 *
 * A copy diz que nada foi enviado nem cobrado, e isso é informação de produto,
 * não conforto: uma falha numa tela que consome IA levanta exatamente essa
 * dúvida, e o silêncio a deixaria de pé.
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
      contexto="chat"
      titulo="O assistente não pôde ser aberto"
      tituloEn="The assistant couldn't be opened"
      descricao="Nenhuma pergunta foi enviada e nada foi cobrado. O manual continua acessível pela navegação."
      descricaoEn="No question was sent and nothing was charged. The manual is still reachable from the navigation."
      retorno={{
        href: `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs`,
        rotulo: "Voltar ao manual",
        rotuloEn: "Back to the manual",
      }}
    />
  );
}
