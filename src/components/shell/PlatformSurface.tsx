import type { CSSProperties, ElementType, ReactNode } from "react";

/**
 * Devolve os tokens da plataforma a um trecho que vive dentro do canvas.
 *
 * Instrumentos do sistema — status editorial, versão, autoria, aprovação,
 * download, análise — aparecem sobre o conteúdo da marca, mas pertencem ao
 * produto. Sem este boundary eles herdariam a cor do cliente, e a semântica de
 * pronto, rascunho ou erro passaria a mudar de marca para marca.
 *
 * Os tokens `--platform-*` já são herdados do documento; o que este componente
 * reverte são os aliases legados, que o BrandCanvas reaponta para a marca.
 */
const PLATFORM_SCOPE = {} as CSSProperties;

export function PlatformSurface({
  as: Tag = "div",
  className = "",
  style,
  children,
}: {
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Tag style={{ ...PLATFORM_SCOPE, ...style }} className={className}>
      {children}
    </Tag>
  );
}
