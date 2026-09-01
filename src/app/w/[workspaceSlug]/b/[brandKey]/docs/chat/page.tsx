"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AssistantMessage } from "@/components/ai/AssistantMessage";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";

type ChatMessage = { role: "user" | "assistant"; content: string };
type RequestPhase = "idle" | "connecting" | "thinking" | "answering";


const PROGRESS_COPY_POR_IDIOMA: Record<"en" | "pt-BR", Record<Exclude<RequestPhase, "idle">, string>> = {
  en: {
      connecting: "Connecting to the assistant…",
      thinking: "Consulting the brand guide…",
      answering: "Preparing the answer…",
  },
  "pt-BR": {
    connecting: "Conectando ao assistente…",
    thinking: "Consultando o guia da marca…",
    answering: "Preparando a resposta…",
  },
};

export default function ChatPage() {
  // A marca em que esta tela opera, vinda da URL. Sem ela o servidor não
  // saberia qual, e responderia 409 numa conta com mais de uma.
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const progressCopy = PROGRESS_COPY_POR_IDIOMA[isEnglish ? "en" : "pt-BR"];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<RequestPhase>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [demoMode, setDemoMode] = useState<boolean | null>(null);
  const [routeLabel, setRouteLabel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryMessages, setRetryMessages] = useState<ChatMessage[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isBusy = phase !== "idle";

  useEffect(() => {
    if (!isBusy) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isBusy]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, error, notice, phase]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function ask(nextMessages: ChatMessage[]) {
    if (isBusy) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setMessages(nextMessages);
    setError("");
    setNotice("");
    setRetryMessages(null);
    setElapsedSeconds(0);
    setPhase("connecting");

    let receivedText = false;

    try {
      const res = await fetch(comAlvo("/api/ai/chat", alvo), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? (isEnglish ? "Couldn't reach the assistant." : "Não foi possível consultar o assistente."));
      }

      setDemoMode(res.headers.get("X-AI-Demo-Mode") === "true");
      const fallbackUsed = res.headers.get("X-AI-Fallback-Used") === "true";
      const selectedProvider = res.headers.get("X-AI-Provider");
      const selectedModel = res.headers.get("X-AI-Model");
      setRouteLabel(fallbackUsed ? `${selectedProvider ?? (isEnglish ? "AI" : "IA")} · ${selectedModel ?? (isEnglish ? "fallback route" : "rota alternativa")}` : "");
      setPhase("thinking");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        if (!receivedText) {
          receivedText = true;
          setPhase("answering");
          setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
        } else {
          setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
        }
      }

      assistantText += decoder.decode();
      if (!assistantText.trim()) {
        throw new Error(isEnglish ? "The assistant ended without producing an answer." : "O assistente encerrou sem produzir uma resposta.");
      }
    } catch (caught) {
      setRetryMessages(nextMessages);
      if (controller.signal.aborted) {
        setNotice(isEnglish ? "Response interrupted. You can try again whenever you like." : "Resposta interrompida. Você pode tentar novamente quando quiser.");
      } else {
        setError(caught instanceof Error ? caught.message : (isEnglish ? "Network failure while talking to the AI." : "Falha de rede ao conversar com a IA."));
      }
    } finally {
      abortRef.current = null;
      setPhase("idle");
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setInput("");
    void ask(nextMessages);
  }

  function stopResponse() {
    abortRef.current?.abort();
  }

  function retry() {
    if (retryMessages) void ask(retryMessages);
  }

  const slowResponse = phase === "thinking" && elapsedSeconds >= 12;
  const statusText = slowResponse
    ? (isEnglish ? "We're still consulting the guide. You can wait or stop without losing your question." : "Ainda estamos consultando o guia. Você pode aguardar ou interromper sem perder sua pergunta.")
    : phase === "idle"
      ? ""
      : progressCopy[phase];

  return (
    <article className="flex h-full flex-col px-page-inline py-12 md:py-16">
      <div className="mb-6 inline-flex w-fit items-center gap-3 bg-release-analog-turquoise px-4 py-1.5">
        <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-release-analog-black">
          {isEnglish ? "Assistant" : "Assistente"}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1
          className="break-words font-display font-black uppercase leading-[0.9] tracking-tight text-release-analog-white"
          style={{ fontSize: "clamp(2rem, 4.5vw, 4rem)", overflowWrap: "anywhere" }}
        >
          {isEnglish ? <>Brand <span className="text-release-analog-turquoise">Chat</span></> : <>Chat da <span className="text-release-analog-turquoise">Marca</span></>}
        </h1>
        {demoMode && (
          <span className="border border-border-default px-3 py-1 font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">
            {isEnglish ? "Demo mode" : "Modo demo"}
          </span>
        )}
        {routeLabel && (
          <span className="border border-release-analog-turquoise px-3 py-1 font-display text-[10px] font-bold uppercase tracking-wide text-release-analog-turquoise">
            {isEnglish ? "Fallback route" : "Rota alternativa"} · {routeLabel}
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        aria-busy={isBusy}
        className="flex-1 space-y-5 overflow-y-auto border-l-2 border-release-analog-turquoise pl-5 md:pl-8"
      >
        {messages.length === 0 && (
          <p className="text-sm leading-relaxed text-text-secondary">
            {isEnglish
              ? <>Ask about positioning, voice, color, typography — anything in this brand system.</>
              : <>Pergunte sobre posicionamento, tom de voz, cor, tipografia — qualquer coisa deste sistema de marca.</>}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <p className="font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">
              {m.role === "user" ? (isEnglish ? "You" : "Você") : (isEnglish ? "Assistant" : "Assistente")}
            </p>
            {m.role === "assistant" ? (
              <AssistantMessage content={m.content} />
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-release-analog-white md:text-base">
                {m.content}
              </p>
            )}
          </div>
        ))}
        {isBusy && (
          <div role="status" aria-live="polite" className="border border-border-default bg-surface-primary px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-release-analog-turquoise" aria-hidden="true" />
              <p className="text-sm text-release-analog-white">{statusText}</p>
            </div>
            {elapsedSeconds >= 5 && (
              <p className="mt-1 pl-5 font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                {isEnglish ? `${elapsedSeconds}s elapsed` : `${elapsedSeconds}s decorridos`}
              </p>
            )}
          </div>
        )}
        {notice && (
          <div role="status" className="border border-border-default px-4 py-3">
            <p className="text-sm text-text-secondary">{notice}</p>
            {retryMessages && (
              <button
                type="button"
                onClick={retry}
                className="mt-3 font-display text-[11px] font-bold uppercase tracking-wide text-release-analog-white underline decoration-release-analog-turquoise underline-offset-4"
              >
                {isEnglish ? "Try again" : "Tentar novamente"}
              </button>
            )}
          </div>
        )}
        {error && (
          <div role="alert" className="border border-release-analog-blue px-4 py-3">
            <p className="text-sm text-release-analog-blue">{error}</p>
            {retryMessages && (
              <button
                type="button"
                onClick={retry}
                className="mt-3 font-display text-[11px] font-bold uppercase tracking-wide text-release-analog-white underline decoration-release-analog-blue underline-offset-4"
              >
                {isEnglish ? "Try again" : "Tentar novamente"}
              </button>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 border-t border-border-default pt-6 sm:flex-row">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isEnglish ? "Ask about the brand…" : "Pergunte sobre a marca…"}
          aria-label={isEnglish ? "Question for the brand assistant" : "Pergunta para o assistente da marca"}
          className="min-w-0 flex-1 border border-border-default bg-transparent px-4 py-3 text-sm text-release-analog-white placeholder:text-text-secondary focus:border-release-analog-white"
        />
        {isBusy ? (
          <button
            type="button"
            onClick={stopResponse}
            className="border border-release-analog-white px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-release-analog-white"
          >
            {isEnglish ? "Stop" : "Interromper"}
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-release-analog-turquoise px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-release-analog-black disabled:opacity-40"
          >
            {isEnglish ? "Send" : "Enviar"}
          </button>
        )}
      </form>
    </article>
  );
}
