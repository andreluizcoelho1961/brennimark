import { IBM_Plex_Mono, Inter_Tight } from "next/font/google";
import { SCRIPT_DO_TEMA, platformThemeCss } from "@/platform/tokens";
import "@/app/globals.css";

/**
 * O `<html>` e o `<body>` do Brennimark, para as DUAS raízes de layout.
 *
 * O produto tem duas raízes (fatia 5, 24/10/2026): `(plataforma)` — login,
 * contas, manual, console — e `[lang]` — o site público, onde o idioma vem do
 * endereço. Cada raiz precisa declarar o próprio `<html>`, mas fontes, tema e
 * folha de estilo são UMA coisa: duplicá-los deixaria o site e o produto
 * divergirem sem ninguém ver.
 *
 * As fontes da INTERFACE — fatia 6, escolha do André (24/09/2026): Inter
 * Tight, grotesca neutra da linhagem Helvetica; IBM Plex Mono para números e
 * códigos (fólio, páginas, "M · 06 itens"). O Next hospeda os arquivos junto
 * com o site: o navegador de quem usa não chama o Google. A fonte da MARCA é
 * outra coisa e continua separada (--font-brand).
 */
const interface_ = Inter_Tight({ subsets: ["latin"], variable: "--fonte-interface", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--fonte-mono", display: "swap" });

export function RaizDoDocumento({ lang, children }: { lang: string; children: React.ReactNode }) {
  return (
    <html lang={lang} className={`h-full antialiased ${interface_.variable} ${mono.variable}`} suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-head-element -- raiz do documento: o tema precisa chegar antes da primeira pintura */}
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
