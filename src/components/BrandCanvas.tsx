import type { CSSProperties } from "react";
import type { BrandvilleTheme } from "@/brandville/types";
import { brandCssVars } from "@/platform/tokens";

/**
 * Escopo do tema da marca cliente.
 *
 * A moldura do produto — navegação, cabeçalho, administração, configurações —
 * usa a paleta da plataforma, definida no <html>. Tudo que estiver dentro deste
 * container passa a usar a paleta da marca, porque as mesmas variáveis CSS são
 * redefinidas aqui. Nenhum componente precisa saber em qual contexto está.
 *
 * O tema chega por propriedade, vindo da marca que a requisição resolveu.
 * Antes vinha de um objeto de módulo calculado uma vez por processo — o que
 * significava que duas contas com marcas diferentes, servidas pelo mesmo
 * processo, receberiam a mesma paleta.
 */
export function BrandCanvas({
  theme,
  children,
}: {
  theme: BrandvilleTheme;
  children: React.ReactNode;
}) {
  const estilo = brandCssVars(theme) as CSSProperties;
  return (
    // `min-h-full`: a superfície da marca vai até o fim da área. Sem isso ela
    // parava onde o texto acabava e o fundo da moldura reaparecia embaixo,
    // como se a página tivesse sido cortada.
    <div
      data-brand-canvas
      style={estilo}
      className="min-h-full bg-brand-bg text-brand-text"
    >
      {children}
    </div>
  );
}
