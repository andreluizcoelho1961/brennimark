import { getTranslations } from "next-intl/server";

/**
 * Página que não existe nesta marca.
 *
 * Dentro do layout do manual, de propósito: a moldura continua montada, com a
 * navegação e o seletor de marca. A tela genérica do Next tira a pessoa do
 * produto — ela perde a barra, a lista de páginas e o caminho de volta, e a
 * única saída vira o botão de voltar do navegador.
 *
 * O texto não afirma que a página não existe em lugar nenhum: ela pode existir
 * em OUTRA marca da mesma conta, e dizer "não existe" seria falso. O que é
 * verdade é que ela não está neste manual.
 */
export default async function PaginaNaoEncontrada() {
  const t = await getTranslations("paginaNaoEncontrada");
  return (
    <div className="flex min-h-[60vh] flex-col justify-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-platform-text-muted">
        404
      </p>
      <h1 className="mt-[var(--space-shell-3)] text-[clamp(1.25rem,2.5vw,1.75rem)] font-semibold tracking-tight text-platform-text">
        {t("titulo")}
      </h1>
      <p className="mt-[var(--space-shell-3)] max-w-[42ch] text-[15px] leading-relaxed text-platform-text-muted">
        {t("texto")}
      </p>
    </div>
  );
}
