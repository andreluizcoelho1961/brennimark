import "./site.css";

/**
 * O grupo do SITE público. Os parênteses no nome da pasta dizem ao Next que
 * ela organiza o código mas não entra no endereço: `(site)/vini` é `/vini`.
 *
 * Aqui só entra o estilo do site; a moldura (cabeçalho, selo, diálogo) vem de
 * `MolduraDoSite`, que cada página usa, porque a home e as páginas internas
 * se comportam diferente (trilho de capítulos × documento que rola).
 */
export default function LayoutDoSite({ children }: { children: React.ReactNode }) {
  return children;
}
