import type { Metadata } from "next";
import { Cores } from "@/components/ferramentas/Cores";

export const metadata: Metadata = {
  title: "Brennimark Cores — que cor é essa?",
  description: "Pegue uma cor de qualquer lugar da tela e saiba os códigos, o nome, o contraste e como ela aparece para quem não enxerga certas cores. Gratuito, no seu navegador.",
  robots: { index: false, follow: false },
};

/**
 * O Brennimark Cores gratuito (10/10/2026): o modo Medir, para todo mundo. A
 * página é estática; tudo acontece no navegador de quem usa.
 */
export default function PaginaDoCores() {
  return (
    <>
      <div className="border-b border-platform-border px-6 py-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-platform-text-muted">Brennimark Cores</p>
        <h1 className="mt-2 text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold tracking-tight">Que cor é essa?</h1>
        <p className="mt-2 max-w-[44rem] text-[15px] leading-relaxed text-platform-text-muted">
          Pegue uma cor de qualquer lugar da tela e saiba os códigos, um nome em português, se dá para ler texto sobre ela e como ela aparece para quem não enxerga certas cores. Gratuito, e nada sai do seu computador.
        </p>
      </div>
      <Cores />
    </>
  );
}
