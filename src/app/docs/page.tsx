import { redirect } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { EscolhaDeContexto } from "@/components/shell/EscolhaDeContexto";
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
    return (
      <LocaleProvider locale={contexto.locale}>
        {/* Fora da moldura não há AppShell para prover o marco principal, e
            uma página sem <main> deixa quem usa leitor de tela sem o atalho
            para o conteúdo. */}
        <main className="min-h-dvh bg-platform-bg">
        <EmptyBrandState
          podeImportar
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
        <EscolhaDeContexto opcoes={pares} />
      </main>
    </LocaleProvider>
  );
}
