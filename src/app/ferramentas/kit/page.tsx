import type { Metadata } from "next";
import { KitAvulso } from "@/components/ferramentas/KitAvulso";

export const metadata: Metadata = {
  title: "Brennimark Kit — todos os tamanhos do seu logo",
  description: "Envie o logo e baixe, num clique, ícones do site, perfis e capas de redes, assinatura de e-mail e arquivos de apresentação. Tudo feito no seu computador.",
  robots: { index: false, follow: false },
};

/**
 * O Brennimark Kit gratuito (09/10/2026). A página é estática: o trabalho todo
 * acontece no navegador de quem usa, e nada é enviado ao servidor.
 */
export default function PaginaDoKit() {
  return (
    <>
      <div className="border-b border-platform-border px-6 py-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-platform-text-muted">Brennimark Kit</p>
        <h1 className="mt-2 text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold tracking-tight">Todos os tamanhos do seu logo, num clique</h1>
        <p className="mt-2 max-w-[44rem] text-[15px] leading-relaxed text-platform-text-muted">
          Ícones do site, perfis e capas das redes, assinatura de e-mail, endomarketing e arquivos de apresentação. Gratuito, e o seu arquivo não sai do seu computador.
        </p>
      </div>
      <KitAvulso />
    </>
  );
}
