"use client";

import { LimiteDeErro } from "@/components/shell/LimiteDeErro";

/**
 * Falha na importação.
 *
 * Ela vive na conta, não na marca — a rota também. A saída segura é o
 * resolvedor, e não uma marca: no meio de uma primeira importação pode não
 * existir marca nenhuma para onde voltar.
 *
 * A copy é explícita sobre o que NÃO aconteceu. Uma falha aqui, sem essa
 * frase, deixa a pessoa sem saber se metade de um manual de 743 páginas ficou
 * gravada — e a resposta certa, pelo desenho da RPC, é que ou entrou tudo ou
 * não entrou nada.
 */
export default function ErroNaImportacao({
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
      contexto="importacao"
      titulo="A importação não pôde continuar"
      tituloEn="The import couldn't continue"
      descricao="Nenhuma marca foi criada e nenhuma página foi gravada. O arquivo enviado não vira conteúdo sem a publicação terminar."
      descricaoEn="No brand was created and no page was saved. An uploaded file doesn't become content unless publishing completes."
      retorno={{ href: "/docs", rotulo: "Voltar", rotuloEn: "Go back" }}
    />
  );
}
