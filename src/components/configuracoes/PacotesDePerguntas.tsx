"use client";

import { useState } from "react";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { localeDeFormato } from "@/platform/locale";
import { PACOTES } from "@/lib/cobranca/pacotes";

/**
 * Comprar mais perguntas sem trocar de plano (08/11/2026). A tela só pede o código do pacote;
 * o preço e a quantidade são do catálogo no servidor, e quem credita é o webhook depois do
 * cartão. Vale até o fim do mês seguinte ao da compra.
 */
const BOTAO = "border border-platform-signal px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50";

export function PacotesDePerguntas({ isEnglish, esgotada }: { isEnglish: boolean; esgotada: boolean }) {
  const alvo = useAlvo();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  async function comprar(codigo: string) {
    setOcupado(codigo);
    setErro("");
    const resposta = await fetch(comAlvo("/api/cobranca/pacote", alvo), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pacote: codigo }),
    }).catch(() => null);
    const corpo = resposta ? await resposta.json().catch(() => null) : null;
    if (resposta?.ok && typeof corpo?.url === "string") {
      window.location.assign(corpo.url);
      return;
    }
    setErro(corpo?.message ?? (isEnglish ? "Couldn't open the payment page." : "Não foi possível abrir a página de pagamento."));
    setOcupado(null);
  }

  const moeda = new Intl.NumberFormat(localeDeFormato(isEnglish), { style: "currency", currency: "BRL" });

  return (
    <div data-pacotes-de-perguntas className="mt-6 border-t border-platform-border pt-4">
      <p className="text-sm text-platform-text">
        {esgotada
          ? (isEnglish ? "Out of questions before the month ends? Add more without changing plan." : "Acabaram as perguntas antes do fim do mês? Compre mais sem trocar de plano.")
          : (isEnglish ? "Need more questions this month? Add a pack without changing plan." : "Precisa de mais perguntas neste mês? Compre um pacote sem trocar de plano.")}
      </p>
      <ul className="mt-3 flex flex-wrap gap-3">
        {PACOTES.map((p) => (
          <li key={p.codigo}>
            <button type="button" data-comprar-pacote={p.codigo} disabled={ocupado !== null} onClick={() => comprar(p.codigo)} className={BOTAO}>
              {ocupado === p.codigo
                ? (isEnglish ? "Opening…" : "Abrindo…")
                : `${p.quantidade} ${isEnglish ? "questions" : "perguntas"} · ${moeda.format(p.valorCentavos / 100)}`}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-platform-text-muted">
        {isEnglish
          ? "One-time card payment. Valid until the end of next month. Used questions are not refundable; the 7-day withdrawal right applies to unused packs."
          : "Pagamento único no cartão. Vale até o fim do mês seguinte ao da compra. Pergunta já usada não é reembolsável; o direito de arrependimento de 7 dias vale para pacote não usado."}
      </p>
      {erro && <p role="alert" className="mt-2 text-sm text-platform-text">{erro}</p>}
    </div>
  );
}
