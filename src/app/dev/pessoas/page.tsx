import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { PessoasEAcesso } from "@/components/pessoas/PessoasEAcesso";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada de Pessoas e acesso.
 *
 * A tela real vive em `/w/…/pessoas` e exige sessão e conta — corretamente. A
 * suíte de navegador roda sem banco, então sem esta rota o comportamento de
 * conceder e revogar seria provado só por leitura de código.
 *
 * O teste finge `/api/admin/pessoas`, como os da biblioteca fingem o acervo. O
 * que se exercita é o caminho de produção do componente, do clique à requisição.
 */
export default async function BancadaDePessoas() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg p-8">
        <PessoasEAcesso />
      </main>
    </LocaleProvider>
  );
}
