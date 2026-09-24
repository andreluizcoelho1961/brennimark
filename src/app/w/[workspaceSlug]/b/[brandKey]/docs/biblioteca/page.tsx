import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { AssetLibrary } from "@/components/assets/AssetLibrary";
import { CatalogoDeMateriais } from "@/components/materiais/Materiais";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

/**
 * Materiais da marca — fatia 5.
 *
 * O catálogo é para todos que alcançam a marca. A seção de gerenciar (criar
 * item, enviar, substituir, descontinuar, ver o registro de downloads) é de
 * quem ADMINISTRA a marca — até 24/09 a página não passava essa permissão ao
 * componente, e ninguém conseguia enviar material em produção.
 *
 * A interface decide o que APARECE; as rotas e a RLS decidem o que é permitido.
 */
export default async function PaginaDeMateriais({
  params,
}: {
  params: Promise<{ workspaceSlug: string; brandKey: string }>;
}) {
  // O acesso à marca é conferido pelo layout; aqui só se decide o que
  // APARECE. Sem contexto pronto, nada de gerenciar — e a página não vira 404.
  const contexto = await resolveWorkspaceContext(await params);
  const administra = contexto.access === "ready" && contexto.capabilities.includes("administrar");
  const en = inEnglish(PRODUCT_LOCALE);

  return (
    <div>
      <CatalogoDeMateriais podeGerenciar={administra} />
      {administra && (
        <details className="mx-[var(--space-shell-5)] mb-[var(--space-shell-5)] border-t border-platform-border pt-[var(--space-shell-4)]" data-gerenciar-materiais>
          <summary className="cursor-pointer font-display text-[11px] font-bold uppercase tracking-[0.12em] text-platform-text-muted hover:text-platform-text">
            {en ? "Manage materials" : "Gerenciar materiais"}
          </summary>
          <div className="mt-[var(--space-shell-4)]">
            <AssetLibrary canManage />
          </div>
        </details>
      )}
    </div>
  );
}
