"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { artigoDaTela } from "@/lib/ajuda/da-tela";

/**
 * O painel Ajuda da moldura — 17/10/2026, decisão do André (opção A): um item
 * "Ajuda" na coluna da plataforma abre, pela direita, o artigo da tela em que a
 * pessoa está. Sem ir procurar em outro lugar.
 *
 * O botão da coluna (e o da gaveta, no celular) só dispara um evento da janela;
 * quem guarda o estado é este componente, montado uma vez no AppShellV2. Um
 * evento evita levar `aberto` por três componentes que não têm nada a ver com
 * ele.
 *
 * Os artigos vêm de `/api/ajuda` (a mesma fonte do site), na visão de quem está
 * dentro de uma marca. Tokens da PLATAFORMA, nunca a cor da marca cliente. Não é
 * modal: o painel não trava a tela, e Esc fecha.
 */
export const EVENTO_ABRIR_AJUDA = "brennimark:abrir-ajuda";

type ItemDaLista = { slug: string; titulo: string; resumo: string; categoria: string };
type Aberto = { slug: string; titulo: string; html: string };

export function AjudaDaMoldura() {
  const pathname = usePathname() ?? "";
  const [aberto, setAberto] = useState(false);
  const [artigo, setArtigo] = useState<Aberto | null>(null);
  const [lista, setLista] = useState<ItemDaLista[] | null>(null);
  const [verLista, setVerLista] = useState(false);
  const [erro, setErro] = useState("");
  const idDoTitulo = useId();
  const fechar = useRef<HTMLButtonElement>(null);
  const quemAbriu = useRef<Element | null>(null);

  const carregar = useCallback(async (slug: string) => {
    setErro("");
    const r = await fetch(`/api/ajuda?slug=${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) { setArtigo(corpo); setVerLista(false); } else setErro(corpo.message ?? "Não foi possível abrir a ajuda agora.");
  }, []);

  // Abrir: guarda quem abriu (para devolver o foco), busca a lista e o artigo da tela.
  useEffect(() => {
    const abrir = () => {
      quemAbriu.current = document.activeElement;
      setAberto(true);
    };
    window.addEventListener(EVENTO_ABRIR_AJUDA, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_AJUDA, abrir);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    (async () => {
      const r = await fetch("/api/ajuda", { cache: "no-store" }).catch(() => null);
      const corpo = r ? await r.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (r?.ok) setLista(corpo.artigos);
      const slug = artigoDaTela(pathname);
      if (slug) await carregar(slug);
      else { setArtigo(null); setVerLista(true); }
    })();
    fechar.current?.focus();
    return () => { cancelado = true; };
  }, [aberto, pathname, carregar]);

  const fecharPainel = useCallback(() => {
    setAberto(false);
    (quemAbriu.current as HTMLElement | null)?.focus?.();
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fecharPainel(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, fecharPainel]);

  if (!aberto) return null;

  return (
    <aside data-ajuda-da-moldura role="dialog" aria-modal="false" aria-labelledby={idDoTitulo}
      // Termina acima do fim da tela: o botão do Vini vive no canto de baixo à direita
      // e precisa continuar à vista e clicável.
      className="fixed bottom-[4.5rem] right-0 top-[var(--shell-topbar)] z-40 flex w-[min(440px,100vw)] flex-col border-b border-l border-platform-border bg-platform-panel shadow-[0_0_24px_rgba(0,22,33,0.12)]">
      <header className="flex items-center justify-between gap-3 border-b border-platform-border px-5 py-3">
        <h2 id={idDoTitulo} className="min-w-0 truncate font-display text-[17px] font-semibold tracking-tight text-platform-text">
          {verLista || !artigo ? "Ajuda" : artigo.titulo}
        </h2>
        <button ref={fechar} type="button" data-ajuda-fechar onClick={fecharPainel}
          className="flex-none rounded-[var(--radius-control)] border border-platform-border px-2.5 py-1 text-sm text-platform-text">
          Fechar
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {erro && <p role="alert" className="text-sm text-platform-text">{erro}</p>}
        {verLista || !artigo ? (
          <>
            {!artigo && !erro && <p className="mb-3 text-sm text-platform-text-muted">Não há um artigo para esta tela. Escolha um assunto:</p>}
            <ul data-ajuda-lista className="flex flex-col">
              {(lista ?? []).map((a) => (
                <li key={a.slug} className="border-t border-platform-border first:border-t-0">
                  <button type="button" onClick={() => void carregar(a.slug)} className="flex w-full flex-col items-start gap-0.5 py-3 text-left">
                    <span className="text-sm font-medium text-platform-text">{a.titulo}</span>
                    <span className="text-[13px] text-platform-text-muted">{a.resumo}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div data-ajuda-artigo className="prosa-da-ajuda" dangerouslySetInnerHTML={{ __html: artigo.html }} />
        )}
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-platform-border px-5 py-3 text-[13px] text-platform-text-muted">
        {artigo && !verLista
          ? <button type="button" data-ajuda-outros onClick={() => setVerLista(true)} className="underline underline-offset-4 hover:text-platform-text">Outros assuntos</button>
          : <span />}
        <a href={artigo && !verLista ? `/ajuda/${artigo.slug}` : "/ajuda"} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-platform-text">
          Abrir na Central de ajuda
        </a>
      </footer>
    </aside>
  );
}
