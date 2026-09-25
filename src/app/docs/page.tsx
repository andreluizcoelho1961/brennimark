import { redirect } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brennimark/workspace-context";
import { TelaInicial } from "@/components/shell/TelaInicial";
import { EmptyBrandState } from "@/components/shell/EmptyBrandState";
import { MolduraDaConta } from "@/components/shell/MolduraDaConta";

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

  /*
   * Todos os estados abaixo desenham DENTRO da moldura (plano da interface §2,
   * 18/09): entrar é cair dentro da plataforma, e nenhum estado é página solta.
   *
   * A conta em exibição é a única, quando a pessoa está em uma só — o caso de
   * toda agência. Em várias, nenhuma é escolhida por ela: a coluna mostra só
   * Marcas, e a gestão aparece ao entrar numa conta.
   */
  const contaUnica = contexto.opcoes.length === 1 ? contexto.opcoes[0] : undefined;

  /*
   * Entrou e não tem acesso a nada (17/09/2026, conta de time). O vazio de
   * quem espera alguém liberar — sem botão de importar, que o devolveria aqui.
   */
  if (contexto.access === "sem-acesso") {
    return (
      <MolduraDaConta contexto={contexto}>
        <EmptyBrandState podeImportar={false} />
      </MolduraDaConta>
    );
  }

  if (contexto.access === "ready" && contexto.workspaceSlug && contexto.brand) {
    redirect(`/w/${contexto.workspaceSlug}/b/${contexto.brand.key}/docs`);
  }

  const pares = contexto.opcoes.flatMap((w) =>
    w.marcas.map((m) => ({ workspaceSlug: w.slug, brandKey: m.key, conta: w.nome, marca: m.nome })),
  );

  if (pares.length === 0) {
    /*
     * Quem administra a conta pode importar; quem não administra, não — e
     * para quem espera acesso, o botão levaria à importação, que o devolveria
     * aqui. A lista VAZIA de contas é o preview local, onde não há a quem
     * pedir: ali vale o convite de importar.
     */
    const participaDeAlgumaConta = contexto.opcoes.length > 0;
    const administraAlgumaConta = contexto.opcoes.some((w) => w.papel === "owner");
    const esperandoAcesso = participaDeAlgumaConta && !administraAlgumaConta;

    return (
      <MolduraDaConta contexto={contexto} contaSlug={contaUnica?.slug}>
        <EmptyBrandState
          podeImportar={!esperandoAcesso}
          contaImportar={
            contexto.workspaceSlug ? `/w/${contexto.workspaceSlug}/importar` : "/onboarding"
          }
        />
      </MolduraDaConta>
    );
  }

  return (
    <MolduraDaConta contexto={contexto} contaSlug={contaUnica?.slug}>
      <TelaInicial
        opcoes={pares}
        novaMarca={contaUnica?.papel === "owner" ? `/w/${contaUnica.slug}/importar` : undefined}
      />
    </MolduraDaConta>
  );
}
