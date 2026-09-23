"use client";

import { useEffect, useState } from "react";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { useIsEnglish } from "@/platform/locale-client";
import type { MensagemDoVini } from "./useConversaDaMarca";

/**
 * As conversas da pessoa nesta marca — fatia 4d.
 *
 * ⚖️ Só as dela: nem quem administra a conta lê (a policy é por autor, e há
 * prova disso). A tela diz isso em uma linha, porque é uma promessa que a
 * pessoa precisa conhecer para confiar no que escreve aqui.
 *
 * Apagar é de verdade: some do banco, com as mensagens. Por isso pergunta
 * antes.
 */
type Resumo = { id: string; titulo: string; atualizadaEm: string };
type Aberta = { id: string; mensagens: MensagemDoVini[] };

export function ListaDeConversas({
  atual, aoAbrir, aoApagarAtual,
}: { atual: string; aoAbrir: (c: Aberta) => void; aoApagarAtual: () => void }) {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);
  const [conversas, setConversas] = useState<Resumo[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const resposta = await fetch(comAlvo("/api/conversas", alvo), { cache: "no-store" });
      const dados = await resposta.json().catch(() => ({}));
      if (cancelado) return;
      if (resposta.ok) setConversas(dados.conversas ?? []);
      else setErro(dados.message ?? t("Não foi possível carregar suas conversas.", "Couldn't load your conversations."));
    })();
    return () => { cancelado = true; };
    // `t` muda a cada render; a busca depende só do alvo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo]);

  async function abrir(id: string) {
    setErro("");
    const resposta = await fetch(comAlvo(`/api/conversas/${id}`, alvo), { cache: "no-store" });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      setErro(dados.message ?? t("Não foi possível abrir a conversa.", "Couldn't open the conversation."));
      return;
    }
    aoAbrir({
      id,
      mensagens: (dados.mensagens ?? []).map((m: {
        papel: "user" | "assistant"; tipo: MensagemDoVini["tipo"]; conteudo: string;
        paginas: Record<string, number>; regras: MensagemDoVini["regras"]; incompleta: boolean;
      }) => ({
        role: m.papel, content: m.conteudo, tipo: m.tipo, paginas: m.paginas, regras: m.regras, incompleta: m.incompleta,
      })),
    });
  }

  async function apagar(c: Resumo) {
    const aviso = t(
      `Apagar “${c.titulo}”? A conversa some de vez — não há como recuperar.`,
      `Delete “${c.titulo}”? The conversation is gone for good — it can't be recovered.`,
    );
    if (!window.confirm(aviso)) return;
    setErro("");
    const resposta = await fetch(comAlvo(`/api/conversas/${c.id}`, alvo), { method: "DELETE" });
    if (!resposta.ok) {
      const dados = await resposta.json().catch(() => ({}));
      setErro(dados.message ?? t("Não foi possível apagar a conversa.", "Couldn't delete the conversation."));
      return;
    }
    setConversas((atuais) => (atuais ?? []).filter((x) => x.id !== c.id));
    if (c.id === atual) aoApagarAtual();
  }

  const quando = (iso: string) => new Date(iso).toLocaleString(isEnglish ? "en-GB" : "pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div data-lista-de-conversas className="space-y-3">
      <p className="text-[12px] leading-relaxed text-platform-text-muted">
        {t(
          "Suas conversas são suas: ninguém mais as lê — nem quem administra a conta.",
          "Your conversations are yours: no one else reads them — not even the account administrator.",
        )}
      </p>
      {erro && <p role="alert" className="text-[13px] text-platform-text">{erro}</p>}
      {conversas === null && !erro && <p className="text-[13px] text-platform-text-muted">{t("Carregando…", "Loading…")}</p>}
      {conversas?.length === 0 && (
        <p data-sem-conversas className="text-[13px] text-platform-text-muted">
          {t("Nenhuma conversa guardada nesta marca ainda.", "No saved conversations for this brand yet.")}
        </p>
      )}
      <ul className="divide-y divide-platform-border border-y border-platform-border">
        {conversas?.map((c) => (
          <li key={c.id} data-conversa={c.id} className="flex items-center gap-2 py-2">
            <button type="button" onClick={() => abrir(c.id)}
              className="min-w-0 flex-1 text-left hover:text-platform-text">
              <span className={`block truncate text-[14px] ${c.id === atual ? "font-semibold text-platform-text" : "text-platform-text"}`}>{c.titulo}</span>
              <span className="block text-[11px] text-platform-text-muted">{quando(c.atualizadaEm)}</span>
            </button>
            <button type="button" onClick={() => apagar(c)} aria-label={t(`Apagar “${c.titulo}”`, `Delete “${c.titulo}”`)}
              className="h-8 border border-platform-border px-2 text-[11px] text-platform-text-muted hover:text-platform-text">
              {t("Apagar", "Delete")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
