import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { AvisoDaCobranca } from "@/components/shell/AvisoDaCobranca";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada do aviso de cobrança da moldura. O segmento `[workspaceSlug]` é o
 * mesmo das telas reais — é dele que o aviso tira a conta. O teste de navegador
 * finge `/api/cobranca/situacao`; a regra de atraso está provada no banco
 * (`scripts/prova-cobranca.sh`, parte 7).
 */
export default function BancadaDoAvisoDaCobranca() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg p-8"><AvisoDaCobranca /><p>Conteúdo da conta</p></main>
    </LocaleProvider>
  );
}
