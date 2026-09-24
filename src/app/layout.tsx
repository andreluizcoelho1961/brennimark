import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter_Tight } from "next/font/google";
import { platformIdentity } from "@/platform/identity";
import { SCRIPT_DO_TEMA, platformThemeCss } from "@/platform/tokens";
import "./globals.css";

/**
 * As fontes da INTERFACE — fatia 6, escolha do André (24/09/2026): Inter
 * Tight, grotesca neutra da linhagem Helvetica; IBM Plex Mono para números e
 * códigos (fólio, páginas, "M · 06 itens"). O Next hospeda os arquivos junto
 * com o site: o navegador de quem usa não chama o Google. A fonte da MARCA é
 * outra coisa e continua separada (--font-brand).
 */
const interface_ = Inter_Tight({ subsets: ["latin"], variable: "--fonte-interface", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--fonte-mono", display: "swap" });

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
    <html lang={LOCALE_PADRAO} className={`h-full antialiased ${interface_.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Os dois temas da moldura, gerados de `identity.ts` (fonte única). */}
        <style dangerouslySetInnerHTML={{ __html: platformThemeCss() }} />
        {/* O tema escolhido, antes da primeira pintura — sem clarão no escuro. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
