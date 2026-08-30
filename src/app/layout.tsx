import type { Metadata, Viewport } from "next";
import { platformThemeStyle } from "@/brandville/config";
import { platformIdentity } from "@/platform/identity";
import "./globals.css";

/**
 * Metadados do PRODUTO, não do manual.
 *
 * Antes o título da aba e o idioma do documento vinham de
 * `brandvilleInstance.metadata` — a marca do cliente batizava a janela do
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

const LOCALE_PADRAO = "pt-BR";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={LOCALE_PADRAO} className="h-full antialiased" style={platformThemeStyle}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
