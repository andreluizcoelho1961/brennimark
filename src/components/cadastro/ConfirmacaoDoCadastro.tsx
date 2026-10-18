"use client";

import { useState } from "react";

/**
 * O botão do e-mail de confirmação (18/10/2026). Nada acontece ao abrir a
 * página — só ao clicar (ver `/api/cadastro/confirmar`).
 */
type Estado = "inicial" | "enviando" | "feito" | "nao-achou" | "erro";

export function ConfirmacaoDoCadastro({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>("inicial");

  async function confirmar() {
    setEstado("enviando");
    try {
      const r = await fetch("/api/cadastro/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!r.ok) { setEstado("erro"); return; }
      const corpo = await r.json() as { achou?: boolean };
      setEstado(corpo.achou ? "feito" : "nao-achou");
    } catch {
      setEstado("erro");
    }
  }

  if (estado === "feito") {
    return (
      <div data-confirmacao-resultado="feito" role="status">
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Pronto, o seu e-mail está confirmado.</h1>
        <p className="mt-3 text-sm leading-relaxed text-platform-text-muted">A partir de agora você recebe os e-mails do Brennimark. Todo e-mail traz um link para sair da lista quando quiser.</p>
      </div>
    );
  }
  if (estado === "nao-achou") {
    return (
      <div data-confirmacao-resultado="nao-achou" role="status">
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Não foi possível confirmar.</h1>
        <p className="mt-3 text-sm leading-relaxed text-platform-text-muted">Este cadastro não existe mais, ou você saiu da lista. Se quiser receber os e-mails, marque a caixa de novo ao baixar uma ferramenta, e enviaremos outra confirmação.</p>
      </div>
    );
  }

  return (
    <div data-confirmacao>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Confirme o seu e-mail</h1>
      <p className="mt-3 text-sm leading-relaxed text-platform-text-muted">Clique para confirmar que você quer receber os e-mails do Brennimark. Nada acontece até você clicar.</p>
      <button type="button" data-confirmacao-confirmar disabled={estado === "enviando"} onClick={confirmar} className="mt-5 rounded-[var(--radius-control)] bg-platform-signal px-4 py-2.5 text-sm font-semibold text-platform-bg disabled:opacity-40">
        {estado === "enviando" ? "Confirmando…" : "Confirmar o meu e-mail"}
      </button>
      {estado === "erro" && <p role="alert" data-confirmacao-erro className="mt-4 text-sm text-platform-danger">Não foi possível agora. Tente de novo em instantes.</p>}
    </div>
  );
}
