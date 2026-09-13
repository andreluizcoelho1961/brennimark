import { redirect } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { TelaInicial } from "@/components/shell/TelaInicial";
import { EmptyBrandState } from "@/components/shell/EmptyBrandState";
import { LocaleProvider } from "@/platform/locale-client";

/**
 * `/docs` deixou de ser uma página e virou um resolvedor.
 *
 * Ele não mostra manual nenhum: decide para qual contexto a pessoa vai e sai
 * da frente. As três saídas são as três respostas possíveis, e a do meio é a
 * que não existia:
 *
 *   uma marca      redireciona, porque não há o que perguntar
 *   várias         PERGUNTA — antes isso era "a primeira", silenciosamente
 *   nenhuma        leva à importação da primeira
 *
 * O endereço continua valendo como atalho: quem digita /docs, ou tem um link
 * antigo, chega ao lugar certo em vez de encontrar 404.
 */
export default async function ResolvedorDeContexto() {
  const contexto = await resolveWorkspaceContext();

  if (contexto.access === "anonymous") redirect("/login");
  if (contexto.access === "onboarding") redirect("/onboarding");

  if (contexto.access === "ready" && contexto.workspaceSlug && contexto.brand) {
    redirect(`/w/${contexto.workspaceSlug}/b/${contexto.brand.key}/docs`);
  }

  const pares = contexto.opcoes.flatMap((w) =>
    w.marcas.map((m) => ({ workspaceSlug: w.slug, brandKey: m.key, conta: w.nome, marca: m.nome })),
  );

  if (pares.length === 0) {
    /*
     * Quem administra a conta pode importar; quem não administra, não.
     *
     * `podeImportar` estava fixo em `true`, e até 13/09/2026 isso era quase
     * inofensivo: só chegava aqui quem tinha conta sem marca nenhuma. Com o
     * acesso por marca, chega também quem participa de uma conta com marcas e
     * ainda não recebeu acesso a nenhuma — e para essa pessoa o botão levava à
     * tela de importação, que a devolvia para cá por não ser quem administra.
     * Laço, sem explicação.
     *
     * O papel vem das opções, que já foram resolvidas: uma consulta a menos, e
     * a mesma fonte que a moldura usa.
     *
     * A lista VAZIA não é o caso de "sem acesso": ela é o preview local, onde
     * não existe conta nenhuma e portanto não há administrador a quem pedir.
     * Ali vale o primeiro texto — foi o que a suíte de navegador cobrou quando
     * a regra era só "administra alguma conta".
     */
    const participaDeAlgumaConta = contexto.opcoes.length > 0;
    const administraAlgumaConta = contexto.opcoes.some((w) => w.papel === "owner");
    const esperandoAcesso = participaDeAlgumaConta && !administraAlgumaConta;

    return (
      <LocaleProvider locale={contexto.locale}>
        {/* Fora da moldura não há AppShell para prover o marco principal, e
            uma página sem <main> deixa quem usa leitor de tela sem o atalho
            para o conteúdo. */}
        <main className="min-h-dvh bg-platform-bg">
        <EmptyBrandState
          podeImportar={!esperandoAcesso}
          contaImportar={
            contexto.workspaceSlug ? `/w/${contexto.workspaceSlug}/importar` : "/onboarding"
          }
        />
        </main>
      </LocaleProvider>
    );
  }

  return (
    <LocaleProvider locale={contexto.locale}>
      <main>
        <TelaInicial opcoes={pares} />
      </main>
    </LocaleProvider>
  );
}
