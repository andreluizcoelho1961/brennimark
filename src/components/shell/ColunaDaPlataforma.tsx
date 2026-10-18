"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { itemAtivo, type GrupoDaColuna } from "./coluna";
import { IconeDaColunaSvg } from "./IconeDaColuna";
import { Dica } from "./Dica";
import { textoDaDica } from "./dicas";
import { EVENTO_ABRIR_AJUDA } from "@/components/ajuda/AjudaDaMoldura";

/**
 * A coluna da plataforma: faixa de ícones que se EXPANDE ao passar o mouse,
 * à maneira do painel do Supabase (spec-menus §9, decisão de 18/09).
 *
 * ─── As quatro regras que decidem se isto fica bom ou irritante ─────────────
 *
 * 1. A expansão SOBREPÕE o conteúdo. A faixa ocupa sempre a mesma largura no
 *    layout; a versão expandida é desenhada por cima. Se empurrasse, o
 *    visualizador de PDF — que calcula a escala pela largura disponível —
 *    redesenharia o manual a cada passada do mouse.
 * 2. Atraso de intenção antes de expandir: o mouse que só atravessa a caminho
 *    do manual não abre a coluna. Recolher é imediato.
 * 3. Teclado: receber foco também expande (`focus-within`), e o rótulo de cada
 *    item está sempre no DOM — recolhido, ele fica visualmente oculto, mas é o
 *    nome acessível do link.
 * 4. Recolhida, a coluna ainda mostra onde se está: o item ativo tem fundo e
 *    fio, nunca só cor.
 *
 * Os três modos do Supabase (aberta, fechada, abrindo ao passar) e os
 * submenus entram depois — estão no plano, fora desta fatia.
 */
const ATRASO_DE_INTENCAO_MS = 200;

export function ColunaDaPlataforma({ grupos }: { grupos: GrupoDaColuna[] }) {
  const isEnglish = useIsEnglish();
  const pathname = usePathname() ?? "";
  const [expandida, setExpandida] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  function aoEntrar() {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setExpandida(true), ATRASO_DE_INTENCAO_MS);
  }
  function aoSair() {
    if (temporizador.current) clearTimeout(temporizador.current);
    setExpandida(false);
  }

  return (
    // O espaço que a coluna ocupa no layout é SEMPRE o da faixa recolhida. A
    // largura expandida vive no filho absoluto, por cima do conteúdo.
    <div className="relative hidden w-[var(--shell-rail,3.5rem)] flex-none lg:block">
      <nav
        aria-label={isEnglish ? "Main navigation" : "Navegação principal"}
        data-coluna-da-plataforma
        data-expandida={expandida ? "sim" : "nao"}
        onMouseEnter={aoEntrar}
        onMouseLeave={aoSair}
        onFocus={() => setExpandida(true)}
        onBlur={(evento) => {
          // Só recolhe quando o foco sai da coluna inteira, não ao passar de um
          // item para o vizinho.
          if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setExpandida(false);
        }}
        onKeyDown={(evento) => { if (evento.key === "Escape") setExpandida(false); }}
        className={`absolute inset-y-0 left-0 z-30 flex flex-col gap-[var(--space-shell-4)] overflow-y-auto overflow-x-hidden border-r border-platform-border bg-platform-bg py-[var(--space-shell-4)] transition-[width,box-shadow] duration-[var(--motion-control)] ${
          expandida ? "w-[15rem] shadow-[0_8px_24px_rgba(0,0,0,0.12)]" : "w-[var(--shell-rail,3.5rem)]"
        }`}
      >
        {grupos.map((grupo, indice) => (
          <div key={grupo.id} data-grupo-da-coluna={grupo.id} className="flex flex-col gap-[var(--space-shell-1)] px-[var(--space-shell-2)]">
            {/* O nome do grupo só aparece expandido; recolhido, um fio separa.
                A altura é a MESMA nos dois (15/10/2026): antes, ao expandir, o
                nome empurrava os itens ~20 px para baixo, e o item que a pessoa
                apontava saía de baixo do cursor (a dica sumia junto). */}
            <div className="flex h-[22px] flex-none items-end px-[var(--space-shell-2)] pb-[var(--space-shell-1)]">
              {expandida
                ? <p className="truncate text-[11px] font-medium leading-none tracking-[0.06em] text-platform-text-muted">{grupo.rotulo}</p>
                : indice > 0 && <span aria-hidden className="mb-[3px] h-px w-full bg-platform-border" />}
            </div>
            {grupo.itens.map((item) => {
              const ativo = itemAtivo(item, pathname);
              const miolo = (
                <>
                  {ativo && <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-platform-signal" />}
                  <IconeDaColunaSvg icone={item.icone} />
                  <span className={expandida ? "min-w-0 flex-1 truncate" : "sr-only"}>{item.rotulo}</span>
                  {item.emBreve && (
                    <span className={expandida ? "flex-none rounded-full border border-platform-border px-2 py-0.5 text-[10px] uppercase tracking-wider" : "sr-only"}>
                      {isEnglish ? "soon" : "em breve"}
                    </span>
                  )}
                </>
              );
              const classe = `relative flex min-h-10 items-center gap-[var(--space-shell-3)] rounded-[var(--radius-control)] px-[var(--space-shell-2)] text-[13px] transition-colors duration-[var(--motion-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus`;

              // Em breve: nem link nem botão que não faz nada. Um item
              // alcançável pelo teclado, que diz o que é e que ainda não abre.
              // A dica do que a ferramenta faz (15/10/2026): no lugar do balão
              // nativo, que só dizia o nome e demorava a aparecer.
              const dica = textoDaDica(item.icone, isEnglish);
              if (item.emBreve || !item.href) {
                const emBreve = isEnglish ? "Coming soon." : "Em breve.";
                return (
                  <Dica key={item.id} titulo={item.rotulo} texto={dica ? `${dica} ${emBreve}` : emBreve}>
                    <span tabIndex={0} aria-disabled="true" data-item-em-breve={item.id}
                      className={`${classe} cursor-default text-platform-text-muted opacity-50`}>
                      {miolo}
                    </span>
                  </Dica>
                );
              }
              const link = (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  data-nav-destination
                  data-item-da-coluna={item.id}
                  data-nav-active={ativo ? "true" : undefined}
                  title={dica ? undefined : expandida ? undefined : item.rotulo}
                  onClick={aoSair}
                  className={`${classe} ${ativo
                    ? "bg-platform-signal-soft font-medium text-platform-text"
                    : "text-platform-text-muted hover:bg-platform-panel hover:text-platform-text"}`}
                >
                  {miolo}
                </Link>
              );
              return dica ? <Dica key={item.id} titulo={item.rotulo} texto={dica}>{link}</Dica> : link;
            })}
          </div>
        ))}
        {/* A Ajuda (17/10/2026): no pé da coluna, para todos — quem só consulta
            também precisa dela. Abre o painel Ajuda; não navega. */}
        <div data-grupo-da-coluna="ajuda" className="mt-auto flex flex-col gap-[var(--space-shell-1)] px-[var(--space-shell-2)]">
          <Dica titulo={isEnglish ? "Help" : "Ajuda"} texto={textoDaDica("ajuda", isEnglish) ?? ""}>
            <button type="button" data-ajuda-abrir
              onClick={() => { aoSair(); window.dispatchEvent(new Event(EVENTO_ABRIR_AJUDA)); }}
              className="relative flex min-h-10 items-center gap-[var(--space-shell-3)] rounded-[var(--radius-control)] px-[var(--space-shell-2)] text-[13px] text-platform-text-muted transition-colors hover:bg-platform-panel hover:text-platform-text">
              <IconeDaColunaSvg icone="ajuda" />
              <span className={expandida ? "min-w-0 flex-1 truncate text-left" : "sr-only"}>{isEnglish ? "Help" : "Ajuda"}</span>
            </button>
          </Dica>
        </div>
      </nav>
    </div>
  );
}

/**
 * A mesma coluna, por extenso, para a gaveta do celular.
 *
 * Abaixo de 1024px não há hover, e a faixa de ícones fica escondida: a gaveta
 * mostra os mesmos grupos, sempre com nome. Uma fonte de dado, dois desenhos —
 * duas listas escritas à mão seriam uma ficando para trás da outra.
 */
export function ListaDaColuna({ grupos, onNavigate }: { grupos: GrupoDaColuna[]; onNavigate?: () => void }) {
  const isEnglish = useIsEnglish();
  const pathname = usePathname() ?? "";
  return (
    <>
      {grupos.map((grupo) => (
        <div key={grupo.id} className="flex flex-col gap-[var(--space-shell-1)]">
          <h2 className="px-[var(--space-shell-3)] pb-[var(--space-shell-2)] text-[11px] font-medium tracking-[0.06em] text-platform-text-muted">{grupo.rotulo}</h2>
          {grupo.itens.map((item) => {
            const ativo = itemAtivo(item, pathname);
            const classe = "relative flex min-h-11 items-center gap-[var(--space-shell-3)] rounded-[var(--radius-control)] px-[var(--space-shell-3)] text-[13px]";
            if (item.emBreve || !item.href) {
              return (
                <span key={item.id} aria-disabled="true" className={`${classe} text-platform-text-muted opacity-50`}>
                  <IconeDaColunaSvg icone={item.icone} />
                  <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
                  <span className="text-[10px] uppercase tracking-wider">{isEnglish ? "soon" : "em breve"}</span>
                </span>
              );
            }
            return (
              <Link key={item.id} href={item.href} onClick={onNavigate}
                aria-current={ativo ? "page" : undefined}
                data-nav-destination data-nav-active={ativo ? "true" : undefined}
                className={`${classe} ${ativo ? "bg-platform-signal-soft font-medium text-platform-text" : "text-platform-text-muted hover:bg-platform-panel hover:text-platform-text"}`}>
                <IconeDaColunaSvg icone={item.icone} />
                <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
              </Link>
            );
          })}
        </div>
      ))}
      <div className="flex flex-col gap-[var(--space-shell-1)]">
        <button type="button" data-ajuda-abrir
          onClick={() => { onNavigate?.(); window.dispatchEvent(new Event(EVENTO_ABRIR_AJUDA)); }}
          className="relative flex min-h-11 items-center gap-[var(--space-shell-3)] rounded-[var(--radius-control)] px-[var(--space-shell-3)] text-[13px] text-platform-text-muted hover:bg-platform-panel hover:text-platform-text">
          <IconeDaColunaSvg icone="ajuda" />
          <span className="min-w-0 flex-1 truncate text-left">{isEnglish ? "Help" : "Ajuda"}</span>
        </button>
      </div>
    </>
  );
}
