/**
 * A marca atual aparece como CONTEXTO de trabalho, não como identidade do
 * produto. Por isso um rótulo tipográfico e não um logo: o logo do cliente
 * pertence ao canvas, onde é conteúdo documentado, não assinatura da moldura.
 *
 * Nenhum token da marca entra aqui — se entrasse, a moldura mudaria de cara a
 * cada instalação, que é exatamente o que a V2 existe para impedir.
 *
 * Nome e descritor chegam por propriedade. O componente não sabe consultar a
 * marca ativa e não deve saber: quem resolve é a requisição, e um componente
 * de apresentação que importa a marca global reintroduz o estado de processo
 * que o patch 1 tirou.
 */
export function WorkspaceIdentity({
  name,
  descriptor,
}: {
  name?: string;
  descriptor?: string;
}) {
  // Sem marca não há contexto para mostrar, e um separador solto sugeriria que
  // falta carregar algo.
  if (!name) return null;

  return (
    <span className="flex min-w-0 items-center gap-[var(--space-shell-2)]">
      <span aria-hidden className="h-4 w-px flex-none bg-platform-border" />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium leading-tight text-platform-text">
          {name}
        </span>
        {descriptor && (
          <span className="block truncate text-[11px] leading-tight text-platform-text-muted">
            {descriptor}
          </span>
        )}
      </span>
    </span>
  );
}
