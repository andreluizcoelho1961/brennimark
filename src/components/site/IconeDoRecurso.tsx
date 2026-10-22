import type { ReactNode } from "react";

/**
 * O ícone de cada recurso na barra da abertura e no tour (22/10/2026): traço
 * fino, na cor do texto, no mesmo desenho dos ícones da coluna da plataforma.
 */
const TRACOS: Record<string, ReactNode> = {
  // livro aberto
  manual: <><path d="M3 5.5c2.8-1 5.8-1 9 .8 3.2-1.8 6.2-1.8 9-.8v13c-2.8-1-5.8-1-9 .8-3.2-1.8-6.2-1.8-9-.8z" /><path d="M12 6.3v13" /></>,
  // balão de conversa
  consulta: <><path d="M4 5h16v10.5H9.5L5.5 19v-3.5H4z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  // lupa com marca de conferido
  analise: <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /><path d="M8 10.6l1.8 1.8 3.2-3.4" /></>,
  // faísca
  prompt: <><path d="M12 3.5l1.7 5.1 5.1 1.7-5.1 1.7L12 17.1l-1.7-5.1-5.1-1.7 5.1-1.7z" /><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>,
  // quatro quadros: o kit
  materiais: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
  // elo de corrente: o link
  entrega: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3" /></>,
  // página com sinal de mais
  complementos: <><path d="M6 3.5h8l4 4v13H6z" /><path d="M14 3.5v4h4" /><path d="M12 11v6M9 14h6" /></>,
};

export function IconeDoRecurso({ id }: { id: string }) {
  return (
    <svg className="icone-recurso" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRACOS[id]}
    </svg>
  );
}
