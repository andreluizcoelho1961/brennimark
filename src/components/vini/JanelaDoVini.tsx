"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import type { DestinoDaMarca } from "@/components/shell/coluna";
import { RespostaDoVini } from "./RespostaDoVini";
import { useConversaDaMarca } from "./useConversaDaMarca";

/**
 * O Vini — a janela da IA, no canto inferior direito (fatia 4a).
 *
 * Substitui o lançador provisório de 18/09, que levava a outra tela: o André
 * reparou no ensaio que "clicar e cair numa outra janela ficou sem sentido".
 * Agora a janela sobe ali mesmo, e perguntar e ler a resposta acontecem dentro
 * dela (spec do Assistente, estado "Conversa").
 *
 * ⚖️ Não é modal: o manual continua usável atrás, e clicar fora NÃO fecha — a
 * pessoa lê a resposta e confere no PDF ao mesmo tempo. Esc recolhe e devolve
 * o foco ao botão. A resposta nova é anunciada por região viva, sem roubar o
 * foco de quem digita.
 *
 * A janela mora na MOLDURA, que não remonta ao trocar de página dentro da
 * marca: por isso a citação leva o PDF à página e a conversa continua aberta.
 *
 * Analisar peça e Histórico ainda abrem as telas atuais, pelo rodapé. Entram
 * na janela nas fatias 4b e 4d.
 */
const ROTULOS: [string, string, string][] = [
  ["analise", "Analisar peça", "Review a piece"],
  ["historico", "Histórico", "History"],
];

function temSegmento(href: string, segmento: string) {
  return href.split(/[?#]/)[0].split("/").includes(segmento);
}

const FASES = {
  "pt-BR": { connecting: "Conectando…", thinking: "Consultando o manual…", answering: "Escrevendo…" },
  en: { connecting: "Connecting…", thinking: "Consulting the manual…", answering: "Writing…" },
} as const;

export function JanelaDoVini({
  destinos, basePath,
}: { destinos: readonly DestinoDaMarca[]; basePath: string }) {
  const isEnglish = useIsEnglish();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState("");
  const botao = useRef<HTMLButtonElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const rolo = useRef<HTMLDivElement>(null);
  const conversa = useConversaDaMarca();

  const temChat = destinos.some((d) => temSegmento(d.href, "chat"));
  const outros = destinos.filter((d) => !temSegmento(d.href, "chat"));

  useEffect(() => {
    if (!aberta) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      setAberta(false);
      botao.current?.focus();
    }
    document.addEventListener("keydown", aoTeclar);
    campo.current?.focus();
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberta]);

  useEffect(() => {
    rolo.current?.scrollTo({ top: rolo.current.scrollHeight, behavior: "smooth" });
  }, [conversa.mensagens, conversa.erro, conversa.aviso, conversa.fase]);

  if (destinos.length === 0) return null;

  function enviar(evento?: FormEvent) {
    evento?.preventDefault();
    if (conversa.perguntar(texto)) setTexto("");
  }

  const fase = conversa.fase === "idle" ? "" : FASES[isEnglish ? "en" : "pt-BR"][conversa.fase];
  const demorando = conversa.fase === "thinking" && conversa.segundos >= 12;

  return (
    <div data-vini className="pointer-events-none fixed bottom-[max(env(safe-area-inset-bottom),1.25rem)] right-[max(env(safe-area-inset-right),1rem)] z-40 flex flex-col items-end gap-[var(--space-shell-3)]">
      {aberta && (
        <section
          id="vini-janela"
          data-vini-janela
          aria-label="Vini"
          className="pointer-events-auto flex h-[min(70dvh,40rem)] w-[min(27.5rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[var(--radius-entry,12px)] border border-platform-border bg-platform-panel shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-platform-border px-[var(--space-shell-4)] py-[var(--space-shell-3)]">
            <div>
              <p className="text-[14px] font-semibold text-platform-text">Vini</p>
              <p className="text-[12px] text-platform-text-muted">{t("Curador do manual desta marca", "Curator of this brand's manual")}</p>
            </div>
            <button
              type="button"
              onClick={() => { setAberta(false); botao.current?.focus(); }}
              aria-label={t("Recolher o Vini", "Collapse Vini")}
              className="flex h-9 w-9 items-center justify-center rounded-md text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:outline-platform-focus"
            >
              <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </header>

          <div
            ref={rolo}
            role="log"
            aria-live="polite"
            aria-busy={conversa.ocupado}
            data-vini-conversa
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-[var(--space-shell-4)] py-[var(--space-shell-4)]"
          >
            {conversa.mensagens.length === 0 && (
              <p className="text-[14px] leading-relaxed text-platform-text-muted">
                {temChat
                  ? t(
                      "Pergunte sobre cor, tipografia, logo, tom de voz — eu mostro onde isso está escrito no manual, e em que página.",
                      "Ask about color, typography, logo, tone of voice — I'll show you where it's written in the manual, and on which page.",
                    )
                  : t("Nesta marca, a conversa não está disponível.", "Conversation isn't available for this brand.")}
              </p>
            )}
            {conversa.mensagens.map((m, i) => (
              <div key={i} data-mensagem={m.role}>
                <p className="mb-1 font-display text-[10px] font-bold uppercase tracking-wide text-platform-text-muted">
                  {m.role === "user" ? t("Você", "You") : "Vini"}
                </p>
                {m.role === "assistant"
                  ? <RespostaDoVini conteudo={m.content} paginas={m.paginas ?? {}} basePath={basePath} />
                  : <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-platform-text">{m.content}</p>}
              </div>
            ))}
            {conversa.ocupado && conversa.fase !== "answering" && (
              <p role="status" className="flex items-center gap-2 text-[13px] text-platform-text-muted">
                <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-platform-signal motion-reduce:animate-none" />
                {demorando
                  ? t("Ainda consultando. Pode esperar ou interromper sem perder a pergunta.", "Still consulting. You can wait or stop without losing your question.")
                  : fase}
              </p>
            )}
            {(conversa.erro || conversa.aviso) && (
              <div role={conversa.erro ? "alert" : "status"} data-vini-erro={conversa.erro ? "" : undefined}
                className="border border-platform-border px-3 py-2 text-[13px] text-platform-text-muted">
                <p>{conversa.erro || conversa.aviso}</p>
                {conversa.podeRepetir && (
                  <button type="button" onClick={conversa.repetir}
                    className="mt-2 text-[12px] font-medium text-platform-text underline underline-offset-4">
                    {t("Tentar de novo", "Try again")}
                  </button>
                )}
              </div>
            )}
          </div>

          <footer className="border-t border-platform-border px-[var(--space-shell-4)] py-[var(--space-shell-3)]">
            {temChat && (
              <form onSubmit={enviar} className="flex items-end gap-2">
                <textarea
                  ref={campo}
                  value={texto}
                  rows={1}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter envia; Shift+Enter quebra linha — o gesto de todo chat.
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviar(); }
                  }}
                  placeholder={t("Pergunte sobre a marca…", "Ask about the brand…")}
                  aria-label={t("Pergunta para o Vini", "Question for Vini")}
                  className="max-h-32 min-h-10 min-w-0 flex-1 resize-none border border-platform-border bg-transparent px-3 py-2 text-[14px] text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal focus:outline-none"
                />
                {conversa.ocupado ? (
                  <button type="button" onClick={conversa.interromper}
                    className="h-10 border border-platform-border px-3 text-[12px] font-medium text-platform-text">
                    {t("Interromper", "Stop")}
                  </button>
                ) : (
                  <button type="submit" disabled={!texto.trim()}
                    className="h-10 bg-platform-signal px-4 text-[12px] font-semibold text-platform-bg disabled:opacity-40">
                    {t("Enviar", "Send")}
                  </button>
                )}
              </form>
            )}
            {outros.length > 0 && (
              <nav aria-label={t("Mais do Vini", "More from Vini")} className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {outros.map((d) => {
                  const rotulo = ROTULOS.find(([s]) => temSegmento(d.href, s));
                  return (
                    <Link key={d.href} href={d.href} data-destino-do-vini
                      className="text-[12px] text-platform-text-muted underline-offset-4 hover:text-platform-text hover:underline">
                      {rotulo ? (isEnglish ? rotulo[2] : rotulo[1]) : d.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </footer>
        </section>
      )}

      <button
        ref={botao}
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        aria-controls="vini-janela"
        data-botao-do-vini
        className="pointer-events-auto flex h-12 items-center gap-[var(--space-shell-2)] rounded-full border border-platform-border bg-platform-panel pl-4 pr-5 text-[15px] font-medium text-platform-text shadow-[0_8px_22px_rgba(0,0,0,0.2)] hover:border-platform-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
      >
        <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5.5h16v10H9l-5 4v-14z" />
          <path d="M8.5 10.5h7" />
        </svg>
        {aberta ? t("Recolher", "Collapse") : t("Pergunte ao Vini", "Ask Vini")}
      </button>
    </div>
  );
}
