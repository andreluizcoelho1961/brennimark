"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * O botão do e-mail de confirmação (18/10/2026). Nada acontece ao abrir a
 * página — só ao clicar (ver `/api/cadastro/confirmar`).
 */
type Estado = "inicial" | "enviando" | "feito" | "sem-cadastro" | "erro";

export function ConfirmacaoDoCadastro({ token }: { token: string }) {
  const t = useTranslations("cadastroPublico");
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
      setEstado(corpo.achou ? "feito" : "sem-cadastro");
    } catch {
      setEstado("erro");
    }
  }

  if (estado === "feito") {
    return (
      <div data-confirmacao-resultado="feito" role="status">
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("confirmar.feitoTitulo")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-platform-text-muted">{t("confirmar.feitoTexto")}</p>
      </div>
    );
  }
  if (estado === "sem-cadastro") {
    return (
      <div data-confirmacao-resultado="sem-cadastro" role="status">
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("confirmar.naoAchouTitulo")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-platform-text-muted">{t("confirmar.naoAchouTexto")}</p>
      </div>
    );
  }

  return (
    <div data-confirmacao>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("confirmar.inicialTitulo")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-platform-text-muted">{t("confirmar.inicialTexto")}</p>
      <button type="button" data-confirmacao-confirmar disabled={estado === "enviando"} onClick={confirmar} className="mt-5 rounded-[var(--radius-control)] bg-platform-signal px-4 py-2.5 text-sm font-semibold text-platform-bg disabled:opacity-40">
        {estado === "enviando" ? t("confirmar.enviando") : t("confirmar.botao")}
      </button>
      {estado === "erro" && <p role="alert" data-confirmacao-erro className="mt-4 text-sm text-platform-danger">{t("erro")}</p>}
    </div>
  );
}
