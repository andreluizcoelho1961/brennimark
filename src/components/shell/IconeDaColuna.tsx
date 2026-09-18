import type { IconeDaColuna } from "./coluna";

/**
 * Os ícones da coluna da plataforma.
 *
 * Desenhados aqui, em SVG de traço, e não trazidos de biblioteca: são onze, e
 * uma dependência inteira para onze desenhos seria peso sem retorno. O traço é
 * `currentColor`, então o ícone herda o estado do item (ativo, apagado) sem
 * cor própria — estado nunca depende só de matiz.
 *
 * O desenho é provisório e geométrico de propósito (grade, linha, círculo): a
 * direção visual do André entra na fatia 6, pelos tokens, e estes traços são
 * fáceis de substituir sem tocar em quem os usa.
 *
 * Sempre `aria-hidden`: quem nomeia o destino é o rótulo do item, nunca o
 * desenho.
 */
const DESENHOS: Record<IconeDaColuna, React.ReactNode> = {
  manual: (<><path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5v-13z" /><path d="M12 6v13" /></>),
  materiais: (<><rect x="4" y="4" width="16" height="4" /><rect x="4" y="10" width="16" height="4" /><rect x="4" y="16" width="16" height="4" /></>),
  marcas: (<><rect x="3.5" y="3.5" width="6" height="6" /><rect x="14.5" y="3.5" width="6" height="6" /><rect x="3.5" y="14.5" width="6" height="6" /><rect x="14.5" y="14.5" width="6" height="6" /></>),
  pessoas: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17.5 14.5c2.2.3 3.6 1.9 4 4.5" /></>),
  links: (<><path d="M10 14l4-4" /><path d="M8.5 10.5L6 13a3.5 3.5 0 005 5l2.5-2.5" /><path d="M15.5 13.5L18 11a3.5 3.5 0 00-5-5l-2.5 2.5" /></>),
  registros: (<><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /></>),
  configuracoes: (<><path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" /><path d="M4 17h2" /><path d="M10 17h10" /><circle cx="8" cy="17" r="2" /></>),
  assistente: (<><path d="M4 5.5h16v10H9l-5 4v-14z" /></>),
  analise: (<><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>),
  historico: (<><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>),
  importar: (<><path d="M12 15V4" /><path d="M7.5 8.5L12 4l4.5 4.5" /><path d="M4 15v5h16v-5" /></>),
  administracao: (<><path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" /><path d="M14 7l3 3" /></>),
  ia: (<><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="M12 8l1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2L12 8z" /></>),
};

export function IconeDaColunaSvg({ icone }: { icone: IconeDaColuna }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none"
    >
      {DESENHOS[icone]}
    </svg>
  );
}
