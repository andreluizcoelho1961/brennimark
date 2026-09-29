import type { ReactNode } from "react";
import { Cabecalho } from "./Cabecalho";
import { ComportamentoDoSite } from "./ComportamentoDoSite";
import { fonteDoSite } from "./fonte";
import { SimbolosDoSite } from "./Simbolos";

/**
 * Liga o movimento ANTES da primeira pintura, para os blocos já nascerem no
 * ponto de partida da animação em vez de aparecer, sumir e subir. Se o
 * JavaScript do site não confirmar em 4 s (`data-site-vivo`), desliga: um
 * script que falhou não pode deixar a página em branco.
 *
 * Vai no <html> porque ele é o único elemento que o React não confere na
 * hidratação (`suppressHydrationWarning` no layout raiz).
 */
const LIGAR_MOVIMENTO = `(function(){var h=document.documentElement;if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;h.setAttribute("data-site-movimento","");setTimeout(function(){if(!h.hasAttribute("data-site-vivo"))h.removeAttribute("data-site-movimento")},4000)})();`;

/**
 * O que toda página do site tem em volta do conteúdo: os símbolos do logo, o
 * cabeçalho, o grão de filme, o selo de demonstração e o diálogo de contato.
 *
 * `pagina` distingue as páginas internas da home: a home é o trilho de
 * capítulos, em tela cheia; a página interna rola como documento.
 */
export function MolduraDoSite({ pagina = false, children }: { pagina?: boolean; children: ReactNode }) {
  return (
    <div className={`bm-site ${fonteDoSite.variable}${pagina ? " on-page" : ""}`}>
      <script dangerouslySetInnerHTML={{ __html: LIGAR_MOVIMENTO }} />
      <SimbolosDoSite />
      <Cabecalho />
      <div className="grain" aria-hidden="true" />
      <button className="stamp-cta" type="button" data-open="dlg-demo" aria-label="Agendar uma demonstração">
        <svg className="stamp-ring" viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <path id="stamp-c" d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0" />
          </defs>
          <text>
            <textPath href="#stamp-c" textLength="280" lengthAdjust="spacing">
              AGENDAR DEMONSTRAÇÃO ✦ FORJADA COM CUIDADO ✦{" "}
            </textPath>
          </text>
        </svg>
        <svg className="stamp-sym" viewBox="0 0 178 162" aria-hidden="true">
          <use href="#bm-silhueta" />
        </svg>
      </button>
      {children}
      <dialog id="dlg-demo" aria-labelledby="dlg-demo-t">
        <button className="dlg-close" type="button" data-close aria-label="Fechar">
          ×
        </button>
        <h2 id="dlg-demo-t">Vamos mostrar o Brennimark funcionando.</h2>
        <p>Escreva para a equipe comercial. Marcamos com você uma demonstração presencial, na sua agência, ou por vídeo.</p>
        <span className="addr">‹e-mail comercial a definir›</span>
        <p>Protótipo: o endereço de contato ainda não existe.</p>
      </dialog>
      <ComportamentoDoSite />
    </div>
  );
}
