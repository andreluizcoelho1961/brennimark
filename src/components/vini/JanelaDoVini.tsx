"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import type { DestinoDaMarca } from "@/components/shell/coluna";
import { RespostaDoVini } from "./RespostaDoVini";
import { PainelDaAnalise } from "./PainelDaAnalise";
import { PainelDoPrompt } from "./PainelDoPrompt";
import { ListaDeConversas } from "./ListaDeConversas";
import { useCopilotoDePrompt } from "./useCopilotoDePrompt";
import type { TipoDePrompt } from "@/lib/ai/copiloto";
import { useAnaliseDaPeca } from "./useAnaliseDaPeca";
import { FORMATOS_DA_PECA } from "@/lib/ai/peca";
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
  // "conversa" (~440 px) ou "analise" (~600 px, altura inteira) — spec §2.
  // "prompt" é a fatia 4c: o copiloto de criação (ADR-0004 §3.1).
  const [modo, setModo] = useState<"conversa" | "analise" | "prompt" | "conversas">("conversa");
  /*
   * A conversa em curso (fatia 4d): chat e copiloto guardam nela. O
   * identificador nasce aqui, sob demanda, e é trocado ao reabrir uma conversa
   * do histórico ou começar outra. Ref, e não estado: mudar de conversa não
   * precisa redesenhar nada por si.
   */
  const conversaAtual = useRef<string | null>(null);
  // Espelho em estado, só para a lista destacar a conversa aberta: ler a ref
  // durante o desenho é proibido (react-hooks/refs).
  const [idDaConversa, setIdDaConversa] = useState<string | null>(null);
  const trocarConversa = (id: string | null) => { conversaAtual.current = id; setIdDaConversa(id); };
  const obterConversa = () => {
    if (!conversaAtual.current) trocarConversa(crypto.randomUUID());
    return conversaAtual.current as string;
  };
  const copiloto = useCopilotoDePrompt(obterConversa);
  const [perguntaDaPeca, setPerguntaDaPeca] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const analise = useAnaliseDaPeca();
  const botao = useRef<HTMLButtonElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const rolo = useRef<HTMLDivElement>(null);
  const conversa = useConversaDaMarca(obterConversa);

  const temChat = destinos.some((d) => temSegmento(d.href, "chat"));
  const temAnalise = destinos.some((d) => temSegmento(d.href, "analise"));
  // Perguntar e analisar acontecem NA janela; o que ainda mora fora (o
  // histórico, até a 4d) fica no rodapé.
  const outros = destinos.filter((d) => !temSegmento(d.href, "chat") && !temSegmento(d.href, "analise"));

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

  /** A peça chega (clipe ou soltar): a janela entra em Análise. Recusada,
   *  também entra — é lá que a recusa diz qual limite barrou. */
  async function receber(peca: File | undefined) {
    if (!peca || !temAnalise) return;
    setModo("analise");
    setAberta(true);
    await analise.escolher(peca);
  }

  function analisarPeca(evento?: FormEvent) {
    evento?.preventDefault();
    void analise.analisar(perguntaDaPeca);
  }

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
          data-modo={modo}
          onDragOver={temAnalise ? (e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setArrastando(true); } } : undefined}
          onDragLeave={temAnalise ? (e) => { if (e.currentTarget === e.target) setArrastando(false); } : undefined}
          onDrop={temAnalise ? (e) => { e.preventDefault(); setArrastando(false); void receber(e.dataTransfer.files[0]); } : undefined}
          className={`pointer-events-auto relative flex flex-col overflow-hidden rounded-[var(--radius-entry,12px)] border bg-platform-panel shadow-[0_16px_40px_rgba(0,0,0,0.28)] ${
            modo !== "conversa"
              ? "h-[calc(100dvh-6.5rem)] w-[min(37.5rem,calc(100vw-2rem))]"
              : "h-[min(70dvh,40rem)] w-[min(27.5rem,calc(100vw-2rem))]"
          } ${arrastando ? "border-platform-signal" : "border-platform-border"}`}
        >
          {arrastando && (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-platform-panel/90 text-[14px] text-platform-text">
              {t("Solte a peça para analisar", "Drop the piece to review it")}
            </div>
          )}
          <header className="flex items-center justify-between gap-3 border-b border-platform-border px-[var(--space-shell-4)] py-[var(--space-shell-3)]">
            <div>
              <p className="text-[14px] font-semibold text-platform-text">
                {modo === "analise" ? t("Vini · Análise de peça", "Vini · Piece review")
                  : modo === "prompt" ? t("Vini · Gerar prompt", "Vini · Build a prompt")
                  : modo === "conversas" ? t("Vini · Conversas", "Vini · Conversations") : "Vini"}
              </p>
              <p className="text-[12px] text-platform-text-muted">{t("Curador do manual desta marca", "Curator of this brand's manual")}</p>
            </div>
            {modo !== "conversa" && temChat && (
              <button type="button" data-voltar-a-conversa onClick={() => setModo("conversa")}
                className="ml-auto text-[12px] text-platform-text-muted underline-offset-4 hover:text-platform-text hover:underline">
                {t("← Conversa", "← Conversation")}
              </button>
            )}
            {modo === "conversa" && temChat && (
              <div className="ml-auto flex items-center gap-3">
                <button type="button" data-abrir-conversas onClick={() => setModo("conversas")}
                  className="text-[12px] text-platform-text-muted underline-offset-4 hover:text-platform-text hover:underline">
                  {t("Conversas", "Conversations")}
                </button>
                {conversa.mensagens.length > 0 && (
                  <button type="button" data-nova-conversa
                    onClick={() => { trocarConversa(null); conversa.limpar(); campo.current?.focus(); }}
                    className="text-[12px] text-platform-text-muted underline-offset-4 hover:text-platform-text hover:underline">
                    {t("Nova", "New")}
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => { setAberta(false); botao.current?.focus(); }}
              aria-label={t("Recolher o Vini", "Collapse Vini")}
              className="flex h-9 w-9 items-center justify-center rounded-md text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:outline-platform-focus"
            >
              <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </header>

          {modo === "conversas" ? (
            <div data-vini-conversas className="min-h-0 flex-1 overflow-y-auto px-[var(--space-shell-4)] py-[var(--space-shell-4)]">
              <ListaDeConversas
                atual={idDaConversa ?? ""}
                aoAbrir={(c) => { trocarConversa(c.id); conversa.carregar(c.mensagens); setModo("conversa"); }}
                aoApagarAtual={() => { trocarConversa(null); conversa.limpar(); }}
              />
            </div>
          ) : modo === "prompt" ? (
            <div aria-live="polite" aria-busy={copiloto.gerando || copiloto.buscando} data-vini-prompt
              className="min-h-0 flex-1 overflow-y-auto px-[var(--space-shell-4)] py-[var(--space-shell-4)]">
              <PainelDoPrompt copiloto={copiloto} basePath={basePath} />
            </div>
          ) : modo === "analise" ? (
            <div aria-live="polite" aria-busy={analise.analisando} data-vini-analise
              className="min-h-0 flex-1 overflow-y-auto px-[var(--space-shell-4)] py-[var(--space-shell-4)]">
              <PainelDaAnalise analise={analise} basePath={basePath} />
            </div>
          ) : (
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
                  ? (
                    <div data-incompleta={m.incompleta ? "" : undefined}>
                      {m.tipo === "prompt" ? (
                        // Prompt gerado pelo copiloto, reaberto do histórico: texto
                        // para copiar, e as regras de que foi feito.
                        <div data-prompt-guardado className="space-y-2">
                          <p className="font-display text-[10px] font-bold uppercase tracking-wide text-platform-text-muted">{t("Prompt gerado", "Generated prompt")}</p>
                          <pre className="whitespace-pre-wrap break-words border border-platform-border bg-platform-bg p-3 font-mono text-[13px] text-platform-text">{m.content}</pre>
                          {(m.regras ?? []).length > 0 && (
                            <p className="text-[12px] text-platform-text-muted">
                              {t("Feito a partir de: ", "Built from: ")}
                              {(m.regras ?? []).map((r) => `${r.titulo}${r.status !== "ready" ? ` (${t("rascunho", "draft")})` : ""}`).join(" · ")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <RespostaDoVini conteudo={m.content} paginas={m.paginas ?? {}} basePath={basePath} />
                      )}
                      {m.incompleta && (
                        <p className="mt-2 font-display text-[10px] font-bold uppercase tracking-wide text-platform-warning">
                          {t("Resposta incompleta", "Incomplete answer")}
                        </p>
                      )}
                    </div>
                  )
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
                data-vini-aviso={conversa.aviso ? "" : undefined}
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
          )}

          <footer className="border-t border-platform-border px-[var(--space-shell-4)] py-[var(--space-shell-3)]">
            {temAnalise && (
              <input ref={arquivo} type="file" hidden data-arquivo-da-peca
                accept={FORMATOS_DA_PECA.join(",")}
                onChange={(e) => { void receber(e.target.files?.[0]); e.target.value = ""; }} />
            )}
            {modo === "prompt" ? (
              <form
                onSubmit={(e) => { e.preventDefault(); void (copiloto.regras ? copiloto.gerar() : copiloto.verRegras()); }}
                className="space-y-2"
              >
                <textarea
                  value={copiloto.descricao}
                  rows={2}
                  maxLength={500}
                  onChange={(e) => copiloto.setDescricao(e.target.value)}
                  placeholder={t("O que você vai criar? Ex.: foto de produto do notebook para Instagram, fundo claro", "What are you creating? E.g.: product photo of the laptop for Instagram, light background")}
                  aria-label={t("O que você vai criar", "What you're creating")}
                  className="block max-h-32 min-h-14 w-full resize-none border border-platform-border bg-transparent px-3 py-2 text-[14px] text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={copiloto.tipo}
                    onChange={(e) => copiloto.setTipo(e.target.value as TipoDePrompt)}
                    aria-label={t("Tipo de peça", "Kind of piece")}
                    className="h-10 border border-platform-border bg-platform-panel px-2 text-[13px] text-platform-text"
                  >
                    <option value="imagem">{t("Imagem", "Image")}</option>
                    <option value="video">{t("Vídeo", "Video")}</option>
                    <option value="texto">{t("Texto", "Text")}</option>
                  </select>
                  <button type="submit"
                    disabled={!copiloto.descricao.trim() || copiloto.buscando || copiloto.gerando}
                    className="ml-auto h-10 bg-platform-signal px-4 text-[12px] font-semibold text-platform-bg disabled:opacity-40">
                    {copiloto.buscando ? t("Buscando regras…", "Finding rules…")
                      : copiloto.gerando ? t("Gerando…", "Building…")
                      : copiloto.regras ? t("Gerar prompt", "Build prompt") : t("Ver as regras", "See the rules")}
                  </button>
                </div>
              </form>
            ) : modo === "analise" ? (
              <form onSubmit={analisarPeca} className="flex items-end gap-2">
                <BotaoDoClipe aoClicar={() => arquivo.current?.click()} rotulo={t("Escolher outra peça", "Choose another piece")} />
                <input
                  value={perguntaDaPeca}
                  onChange={(e) => setPerguntaDaPeca(e.target.value)}
                  placeholder={t("O que conferir? (opcional)", "What to check? (optional)")}
                  aria-label={t("Pergunta sobre a peça", "Question about the piece")}
                  className="h-10 min-w-0 flex-1 border border-platform-border bg-transparent px-3 text-[14px] text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal focus:outline-none"
                />
                <button type="submit" disabled={!analise.peca || analise.analisando}
                  className="h-10 bg-platform-signal px-4 text-[12px] font-semibold text-platform-bg disabled:opacity-40">
                  {analise.analisando ? t("Analisando…", "Reviewing…") : t("Analisar", "Review")}
                </button>
              </form>
            ) : temChat && (
              <form onSubmit={enviar} className="flex items-end gap-2">
                {temAnalise && (
                  <BotaoDoClipe aoClicar={() => arquivo.current?.click()} rotulo={t("Anexar peça para análise", "Attach a piece to review")} />
                )}
                <button type="button" data-abrir-prompt onClick={() => setModo("prompt")}
                  aria-label={t("Gerar prompt com o DNA da marca", "Build a prompt with the brand's DNA")}
                  title={t("Gerar prompt com o DNA da marca", "Build a prompt with the brand's DNA")}
                  className="flex h-10 w-10 flex-none items-center justify-center border border-platform-border text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:outline-platform-focus">
                  <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" /><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z" />
                  </svg>
                </button>
                <textarea
                  ref={campo}
                  value={texto}
                  rows={1}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter envia; Shift+Enter quebra linha — o gesto de todo chat.
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviar(); }
                  }}
                  placeholder={t("Pergunte ao Vini…", "Ask Vini…")}
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
            {modo === "conversa" && !temChat && temAnalise && (
              <button type="button" onClick={() => setModo("analise")}
                className="text-[13px] text-platform-text underline underline-offset-4">
                {t("Analisar uma peça", "Review a piece")}
              </button>
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

/** O clipe: anexar a peça. Alvo de 40 px, rótulo acessível — o desenho não nomeia. */
function BotaoDoClipe({ aoClicar, rotulo }: { aoClicar: () => void; rotulo: string }) {
  return (
    <button type="button" onClick={aoClicar} aria-label={rotulo} title={rotulo} data-clipe-da-peca
      className="flex h-10 w-10 flex-none items-center justify-center border border-platform-border text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:outline-platform-focus">
      <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 11.5l-7.8 7.8a5 5 0 01-7.1-7.1l8.5-8.5a3.3 3.3 0 014.7 4.7l-8.5 8.5a1.7 1.7 0 01-2.4-2.4l7.8-7.8" />
      </svg>
    </button>
  );
}
