import { LocaleProvider } from "@/platform/locale-client";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import type { WorkspaceContext } from "@/lib/brennimark/context";
import { AppShellV2 } from "./AppShellV2";
import { colunaDaPlataforma } from "./coluna";

/**
 * A moldura das telas da CONTA — as que existem sem marca aberta.
 *
 * Plano da interface §2: entrar é cair DENTRO da plataforma, como abrir o
 * Illustrator. Até 18/09/2026 a moldura só existia dentro de uma marca
 * (`/b/<marca>/docs`), e tudo o que vinha antes — a tela inicial, o convite
 * para enviar o primeiro manual, a importação, Pessoas e acesso — aparecia
 * como página solta, sem menu. O ensaio de 18/09 esbarrou exatamente nisso:
 * Pessoas e acesso existia e nada levava até ela.
 *
 * Aqui a mesma moldura envolve essas telas, sem marca: a coluna mostra a
 * plataforma (Marcas e, para quem administra, a gestão) e a barra de cima
 * aparece apagada, esperando uma marca.
 *
 * Recebe o contexto já resolvido por quem chama — a página decide para onde
 * redirecionar antes, e este componente só desenha.
 */
export async function MolduraDaConta({
  contexto,
  contaSlug,
  children,
}: {
  contexto: WorkspaceContext;
  /** A conta em exibição. Ausente quando a pessoa está em várias e ainda não
   *  escolheu — aí a coluna não oferece gestão, porque não há de qual conta. */
  contaSlug?: string;
  children: React.ReactNode;
}) {
  const conta = contaSlug ? contexto.opcoes.find((w) => w.slug === contaSlug) : undefined;

  // Sem marca aberta o contexto não traz a sessão; o e-mail é só para a barra.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  const coluna = colunaDaPlataforma({
    contaSlug: conta?.slug,
    administraConta: conta?.papel === "owner",
    ingles: contexto.locale === "en",
  });

  return (
    <LocaleProvider locale={contexto.locale}>
      <AppShellV2
        coluna={coluna}
        segmentado={{}}
        sections={[]}
        docs={[]}
        userEmail={data.user?.email ?? undefined}
        brandName={conta?.nome}
        sessionControl={<SignOutButton />}
      >
        {children}
      </AppShellV2>
    </LocaleProvider>
  );
}
