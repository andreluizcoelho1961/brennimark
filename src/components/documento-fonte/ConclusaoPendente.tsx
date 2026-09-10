"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIsEnglish } from "@/platform/locale-client";
import {
  relatarConclusao, relatarPendenciaDeSecao,
} from "@/lib/documento-fonte/conclusao-da-publicacao";
import { registrarImportacao } from "@/lib/documento-fonte/registrar-do-navegador";

/**
 * A retomada de uma publicação incompleta, do lado do manual original.
 *
 * ─── Por que ela vive AQUI, e não só no importador ──────────────────────
 *
 * A janela entre as duas transações da publicação sobrevive a coisas que o
 * importador não sobrevive: recarregar a aba, fechar o navegador, trocar de
 * aparelho, ou ser outra pessoa que abre a marca depois. Uma retomada que só
 * existisse na tela de importação seria uma retomada disponível exatamente
 * enquanto ninguém precisa dela.
 *
 * O pedido são duas cordas — chave da marca e id da importação —, e o
 * manifesto é derivado no servidor do relatório que a primeira transação
 * gravou. É isso que torna a repetição possível sem nenhum estado do cliente:
 * ver `documento-fonte/registrar.ts`.
 *
 * Esta é a tela do documento-fonte, então é o lugar honesto para dizer que o
 * documento-fonte não está registrado.
 */
export function ConclusaoPendente({
  contaSlug,
  marcaChave,
  importId,
}: {
  /** O slug da conta: `brands.key` é único dentro dela, não globalmente. */
  contaSlug: string;
  marcaChave: string;
  importId: string;
}) {
  const isEnglish = useIsEnglish();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);
  const router = useRouter();

  const [tentando, setTentando] = useState(false);
  const [falha, setFalha] = useState<{ codigo: string } | null>(null);

  async function tentar() {
    setTentando(true);
    const registro = await registrarImportacao({
      workspace: contaSlug, marca: marcaChave, importId,
    });
    setTentando(false);

    if (!registro.ok) {
      // O código, nunca a mensagem do banco: o texto é decisão desta camada.
      setFalha({ codigo: registro.codigo });
      return;
    }
    // Recarrega do servidor: quem decide se a pendência ainda existe é a
    // linha do banco, e não este componente.
    router.refresh();
  }

  const relato = falha ? relatarConclusao(falha.codigo) : null;

  return (
    <section
      aria-labelledby="conclusao-pendente-titulo"
      className="border-b border-platform-warning bg-platform-panel px-[var(--space-shell-4)] py-[var(--space-shell-3)]"
    >
      <div className="mx-auto flex max-w-[68rem] flex-wrap items-center gap-[var(--space-shell-3)]">
        <div className="min-w-[18rem] flex-1">
          <h2
            id="conclusao-pendente-titulo"
            className="text-[13px] font-semibold text-platform-text"
          >
            {t("Registro do documento original pendente", "Source document registration pending")}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-platform-text-muted">
            {relato
              ? t(relato.pt, relato.en)
              : t(
                  "O manual está aqui e pode ser lido normalmente. O que falta é o registro página por página — medida, cobertura e procedência — que a busca e a curadoria usam. Concluir não altera nada do que já existe.",
                  "The manual is here and reads normally. What's missing is the page-by-page record — size, coverage and provenance — used by search and curation. Finishing changes nothing that already exists.",
                )}
          </p>
        </div>

        {/* Sem nova tentativa a oferecer, o bloco continua: dizer que está
            pendente vale mesmo quando a ação é de outra pessoa. */}
        {(!relato || relato.ofereceNovaTentativa) && (
          <button
            type="button"
            disabled={tentando}
            onClick={() => void tentar()}
            className="flex min-h-11 items-center rounded-[var(--radius-control)] border border-platform-border px-[var(--space-shell-4)] text-[13px] font-medium text-platform-text hover:border-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus disabled:opacity-40"
          >
            {tentando
              ? t("Concluindo…", "Finishing…")
              : t("Concluir o registro", "Finish registration")}
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Páginas registradas sem seção — pendência de CURADORIA, não defeito.
 *
 * Cliente por um motivo só: o produto é bilíngue, e o idioma da interface é
 * decidido no cliente por `useIsEnglish`. Um parágrafo em português fixo numa
 * página de servidor seria a fronteira do idioma vazando, que é exatamente o
 * que a guarda do projeto existe para impedir.
 */
export function PendenciaDeSecao({
  paginasSemSecao,
  total,
}: {
  /** `null` quando não foi medido; o componente então não afirma nada. */
  paginasSemSecao: number | null;
  total: number;
}) {
  const isEnglish = useIsEnglish();
  const relato = relatarPendenciaDeSecao(paginasSemSecao, total);
  if (!relato) return null;

  return (
    <p
      role="status"
      className="border-b border-platform-border px-[var(--space-shell-4)] py-[var(--space-shell-3)] text-[12px] text-platform-text-muted"
    >
      {isEnglish ? relato.en : relato.pt}
    </p>
  );
}
