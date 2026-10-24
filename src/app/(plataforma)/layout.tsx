import type { Metadata, Viewport } from "next";
import { platformIdentity } from "@/platform/identity";
import { RaizDoDocumento } from "@/components/RaizDoDocumento";

/**
 * Metadados do PRODUTO, não do manual.
 *
 * Antes o título da aba e o idioma do documento vinham de
 * `brennimarkInstance.metadata` — a marca do cliente batizava a janela do
 * Brennimark, e um manual em inglês fazia o aplicativo inteiro se declarar em
 * inglês para o leitor de tela. São dois metadados diferentes: a página do
 * manual descreve a marca; a aplicação descreve a si mesma.
 *
 * O `lang` do documento é o idioma da INTERFACE. O patch 3 o liga à
 * preferência da pessoa; até lá é o padrão do produto.
 */
export const metadata: Metadata = {
  title: platformIdentity.displayName,
  description: platformIdentity.tagline,
  robots: { index: false, follow: false },
};

/**
 * `viewportFit: "cover"` é o que faz `env(safe-area-inset-*)` valer alguma
 * coisa. Sem ele o navegador reserva as margens do recorte por conta própria e
 * todos os insets chegam zerados ao CSS — a moldura calcula recuos que nunca
 * acontecem, e num aparelho com recorte a barra fica sob ele.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * A raiz da PLATAFORMA. O site público tem a sua, em `app/[lang]/layout.tsx`,
 * porque o idioma dele vem do endereço. O `lang` daqui começa no padrão do
 * produto e `LocaleProvider` o ajusta ao idioma da pessoa.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RaizDoDocumento lang="pt-BR">{children}</RaizDoDocumento>;
}
