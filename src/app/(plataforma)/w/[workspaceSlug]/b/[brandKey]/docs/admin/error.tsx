"use client";

import { LimiteDeErro } from "@/components/shell/LimiteDeErro";
import { useAlvo } from "@/platform/alvo-client";

/**
 * Falha na administração.
 *
 * "Nenhuma alteração foi salva" é a frase que importa aqui: uma falha numa tela
 * de edição deixa a dúvida sobre o que ficou gravado pela metade, e essa dúvida
 * custa mais que a falha.
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
      contexto="administracao"
      titulo="A administração não pôde ser aberta"
      tituloEn="Administration couldn't be opened"
      descricao="Nenhuma alteração foi salva. O manual continua como estava para quem o consulta."
      descricaoEn="No change was saved. The manual is unchanged for everyone reading it."
      retorno={{
        href: `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs`,
        rotulo: "Voltar ao manual",
        rotuloEn: "Back to the manual",
      }}
    />
  );
}
