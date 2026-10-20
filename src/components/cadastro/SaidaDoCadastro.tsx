"use client";

import { useState } from "react";
import type { AcaoDeSaida } from "@/lib/cadastro/saida";

/**
 * As duas saídas da lista (17/10/2026): parar de receber e-mails, e apagar o
 * cadastro. Apagar não tem volta, então pede um segundo clique. Nada acontece
 * ao abrir a página — só ao clicar (ver `/api/cadastro/saida`).
 */
type Estado = "inicial" | "confirmando-apagar" | "enviando" | "feito-sair" | "feito-apagar" | "nao-achou" | "erro";

const BOTAO = "rounded-[var(--radius-control)] border border-platform-border px-4 py-2 text-sm text-platform-text disabled:opacity-40";

export function SaidaDoCadastro({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>("inicial");

  async function enviar(acao: AcaoDeSaida) {
    setEstado("enviando");
    try {
      const r = await fetch("/api/cadastro/saida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, acao }),
      });
      if (!r.ok) { setEstado("erro"); return; }
      const corpo = await r.json() as { achou?: boolean };
      if (!corpo.achou) { setEstado("nao-achou"); return; }
      setEstado(acao === "apagar" ? "feito-apagar" : "feito-sair");
    } catch {
      setEstado("erro");
    }
  }

  const mensagem: Partial<Record<Estado, [string, string]>> = {
    "feito-sair": ["Pronto, você não vai mais receber e-mails.", "Mantemos o seu cadastro só como registro de que você saiu. Se preferir que ele seja apagado, volte a este link e escolha apagar."],
    "feito-apagar": ["O seu cadastro foi apagado.", "Não guardamos mais o seu nome, o seu e-mail nem as suas respostas."],
    "nao-achou": ["Este cadastro não existe mais.", "Se o seu cadastro já foi apagado, não há mais nada a fazer. Se acha que é um engano, escreva para o contato do rodapé do e-mail."],
  };
  const resultado = mensagem[estado];

  if (resultado) {
    return (
      <div data-saida-resultado={estado} role="status">
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{resultado[0]}</h1>
        <p className="mt-3 text-sm leading-relaxed text-platform-text-muted">{resultado[1]}</p>
      </div>
    );
  }

  const ocupado = estado === "enviando";
  return (
    <div data-saida>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sair da lista do Brennimark</h1>
      <p className="mt-3 text-sm leading-relaxed text-platform-text-muted">Escolha o que você quer. Nada acontece até você clicar.</p>

      <section className="mt-6 rounded-[var(--radius-panel)] border border-platform-border p-4">
        <h2 className="font-semibold">Parar de receber e-mails</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-platform-text-muted">Você continua podendo usar as ferramentas gratuitas.</p>
        <button type="button" data-saida-sair disabled={ocupado} onClick={() => enviar("sair")} className={`${BOTAO} mt-3`}>
          {ocupado ? "Enviando…" : "Parar de receber"}
        </button>
      </section>

      <section className="mt-3 rounded-[var(--radius-panel)] border border-platform-border p-4">
        <h2 className="font-semibold">Apagar o meu cadastro</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-platform-text-muted">Apagamos o seu nome, o seu e-mail e as suas respostas. Não dá para desfazer.</p>
        {estado === "confirmando-apagar" || estado === "enviando" ? (
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" data-saida-apagar-confirmar disabled={ocupado} onClick={() => enviar("apagar")} className="rounded-[var(--radius-control)] bg-platform-danger px-4 py-2 text-sm font-semibold text-platform-bg disabled:opacity-40">
              Apagar de vez
            </button>
            <button type="button" data-saida-apagar-cancelar disabled={ocupado} onClick={() => setEstado("inicial")} className={BOTAO}>Cancelar</button>
          </div>
        ) : (
          <button type="button" data-saida-apagar disabled={ocupado} onClick={() => setEstado("confirmando-apagar")} className={`${BOTAO} mt-3`}>Apagar o meu cadastro</button>
        )}
      </section>

      {estado === "erro" && <p role="alert" data-saida-erro className="mt-4 text-sm text-platform-danger">Não foi possível agora. Tente de novo em instantes.</p>}
    </div>
  );
}
