"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AcaoDeSaida } from "@/lib/cadastro/saida";

/**
 * As duas saídas da lista (17/10/2026): parar de receber e-mails, e apagar o
 * cadastro. Apagar não tem volta, então pede um segundo clique. Nada acontece
 * ao abrir a página — só ao clicar (ver `/api/cadastro/saida`).
 */
type Estado = "inicial" | "confirmando-apagar" | "enviando" | "feito-sair" | "feito-apagar" | "sem-cadastro" | "erro";

const BOTAO = "rounded-[var(--radius-control)] border border-platform-border px-4 py-2 text-sm text-platform-text disabled:opacity-40";

export function SaidaDoCadastro({ token }: { token: string }) {
  const t = useTranslations("cadastroPublico.sair");
  const tGeral = useTranslations("cadastroPublico");
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
      if (!corpo.achou) { setEstado("sem-cadastro"); return; }
      setEstado(acao === "apagar" ? "feito-apagar" : "feito-sair");
    } catch {
      setEstado("erro");
    }
  }

  const mensagem: Partial<Record<Estado, [string, string]>> = {
    "feito-sair": [t("feitoSairTitulo"), t("feitoSairTexto")],
    "feito-apagar": [t("feitoApagarTitulo"), t("feitoApagarTexto")],
    "sem-cadastro": [t("naoAchouTitulo"), t("naoAchouTexto")],
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
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("titulo")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-platform-text-muted">{t("texto")}</p>

      <section className="mt-6 rounded-[var(--radius-panel)] border border-platform-border p-4">
        <h2 className="font-semibold">{t("pararTitulo")}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-platform-text-muted">{t("pararTexto")}</p>
        <button type="button" data-saida-sair disabled={ocupado} onClick={() => enviar("sair")} className={`${BOTAO} mt-3`}>
          {ocupado ? t("enviando") : t("pararBotao")}
        </button>
      </section>

      <section className="mt-3 rounded-[var(--radius-panel)] border border-platform-border p-4">
        <h2 className="font-semibold">{t("apagarTitulo")}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-platform-text-muted">{t("apagarTexto")}</p>
        {estado === "confirmando-apagar" || estado === "enviando" ? (
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" data-saida-apagar-confirmar disabled={ocupado} onClick={() => enviar("apagar")} className="rounded-[var(--radius-control)] bg-platform-danger px-4 py-2 text-sm font-semibold text-platform-bg disabled:opacity-40">
              {t("apagarDeVez")}
            </button>
            <button type="button" data-saida-apagar-cancelar disabled={ocupado} onClick={() => setEstado("inicial")} className={BOTAO}>{t("cancelar")}</button>
          </div>
        ) : (
          <button type="button" data-saida-apagar disabled={ocupado} onClick={() => setEstado("confirmando-apagar")} className={`${BOTAO} mt-3`}>{t("apagarBotao")}</button>
        )}
      </section>

      {estado === "erro" && <p role="alert" data-saida-erro className="mt-4 text-sm text-platform-danger">{tGeral("erro")}</p>}
    </div>
  );
}
