import type { CSSProperties, ReactNode } from "react";
import "@/app/(site)/site.css";
import { TopoDoSiteNasFerramentas } from "@/components/site/TopoDoSiteNasFerramentas";

/**
 * As ferramentas gratuitas do Brennimark (09/10/2026): páginas públicas, sem
 * login, que rodam inteiras no navegador de quem usa. São a isca do site
 * (especificação do Kit, §6) e usam a moldura da plataforma (`--platform-*`)
 * para o conteúdo: são instrumento, e é assim que o assinante as vê lá dentro.
 *
 * O estilo do site (`site.css`) é carregado aqui porque as ferramentas ficam FORA
 * do grupo `(site)`, que é quem o importa. Todas as regras dele são presas a
 * `.bm-site`, e só o bloco do topo leva essa classe.
 *
 * O TOPO é o do site (21/10/2026, pedido do André): a pessoa que chega por um
 * link direto continua vendo o menu do site e volta a Plataforma, Planos etc.
 * sem procurar. O cabeçalho do site é fixo e tem 72 px (`--head`, mais a área
 * segura do celular); o conteúdo desce essa altura, e `--shell-topbar` avisa as
 * telas das ferramentas, que calculam a própria altura por ele.
 */
const ALTURA_DO_TOPO = "calc(72px + env(safe-area-inset-top, 0px))";

export default function LayoutDasFerramentas({ children }: { children: ReactNode }) {
  return (
    <>
      <TopoDoSiteNasFerramentas />
      <div
        className="min-h-dvh bg-platform-bg text-platform-text"
        style={{ paddingTop: ALTURA_DO_TOPO, "--shell-topbar": ALTURA_DO_TOPO } as CSSProperties}
      >
        <main>{children}</main>
      </div>
    </>
  );
}
