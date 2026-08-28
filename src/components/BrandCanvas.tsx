import { brandThemeStyle } from "@/brandville/config";

/**
 * Escopo do tema da marca cliente.
 *
 * A moldura do produto — navegação, cabeçalho, administração, configurações —
 * usa a paleta da plataforma, definida no <html>. Tudo que estiver dentro deste
 * container passa a usar a paleta da marca, porque as mesmas variáveis CSS são
 * redefinidas aqui. Nenhum componente precisa saber em qual contexto está.
 */
export function BrandCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div style={brandThemeStyle} className="bg-background-primary text-text-primary">
      {children}
    </div>
  );
}
