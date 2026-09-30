"use client";

import { useEffect, useMemo, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { milhares, tamanho, type Consumo as Dados, type Teto } from "@/lib/configuracoes/consumo";

const CAMPO = "border border-platform-border bg-platform-bg px-3 py-2 text-sm text-platform-text focus:border-platform-signal focus:outline-none";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";
const TH = "py-2 pr-4 font-bold";
const TD = "py-2 pr-4 tabular-nums";

/** Os últimos doze meses de Brasília, do atual para trás: "2026-09", "2026-08"… */
function ultimosMeses(agora = new Date()): string[] {
  const atual = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(agora).slice(0, 7);
  const [ano, mes] = atual.split("-").map(Number);
  return Array.from({ length: 12 }, (_, k) => {
    const d = new Date(Date.UTC(ano, mes - 1 - k, 15));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * Configurações › Consumo (30/09/2026). Uso do Vini e armazenamento por marca,
 * e quanto do teto da conta já foi usado — sem dinheiro (decisão do André).
 *
 * O `<select>` de mês, e não `<input type="month">`: o Safari do Mac mostra
 * esse campo como texto livre.
 */
export function Consumo() {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const meses = useMemo(() => ultimosMeses(), []);
  const [mes, setMes] = useState(meses[0]);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const resposta = await fetch(comAlvo(`/api/configuracoes/consumo?mes=${mes}`, alvo), { cache: "no-store" }).catch(() => null);
      const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (resposta?.ok) {
        setDados(corpo as Dados);
      } else {
        setErro(resposta
          ? (corpo.message ?? t("Couldn't load the usage.", "Não foi possível carregar o consumo."))
          : t("No connection: couldn't load the usage.", "Sem conexão: não foi possível carregar o consumo."));
      }
    })();
    return () => { cancelado = true; };
    // `t` muda a cada render; a busca depende do mês e do alvo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, alvo]);

  function trocarMes(proximo: string) {
    setErro("");
    setDados(null);
    setMes(proximo);
  }

  const nomeDoMes = (m: string) =>
    new Intl.DateTimeFormat(isEnglish ? "en-US" : "pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-15T12:00:00Z`));
  const diaCurto = (d: string) =>
    new Intl.DateTimeFormat(isEnglish ? "en-US" : "pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

  return (
    <div data-consumo className="space-y-10">
      <label className="block w-fit">
        <span className={ROTULO}>{t("Month", "Mês")}</span>
        <select data-mes value={mes} onChange={(e) => trocarMes(e.target.value)} className={CAMPO}>
          {meses.map((m) => <option key={m} value={m}>{nomeDoMes(m)}</option>)}
        </select>
      </label>

      {erro && <p role="alert" className="text-sm text-platform-text">{erro}</p>}
      {!dados && !erro && <p className="text-sm text-platform-text-muted">{t("Loading…", "Carregando…")}</p>}

      {dados && (
        <>
          <section aria-labelledby="titulo-do-vini">
            <h2 id="titulo-do-vini" className="font-display text-sm font-black uppercase tracking-wider text-platform-text">
              {t("Vini's limit, now", "Limite do Vini, agora")}
            </h2>
            {dados.contaPausada && (
              <p data-conta-pausada role="status" className="mt-3 border-l-2 border-platform-text pl-3 text-sm font-bold text-platform-text">
                {t(
                  "Brennimark has paused Vini for this account. If this continues, contact Brennimark support.",
                  "A Brennimark pausou o Vini nesta conta. Se continuar, fale com o suporte da Brennimark.",
                )}
              </p>
            )}
            {dados.tetos.length === 0 ? (
              <p data-sem-teto className="mt-3 text-sm text-platform-text-muted">
                {t("No limit has been set for this account yet.", "Esta conta ainda não tem limite definido.")}
              </p>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {dados.tetos.map((teto) => <CartaoDoTeto key={teto.periodo} teto={teto} t={t} />)}
              </div>
            )}
          </section>

          <section aria-labelledby="titulo-por-marca">
            <h2 id="titulo-por-marca" className="font-display text-sm font-black uppercase tracking-wider text-platform-text">
              {t("By brand", "Por marca")} · {nomeDoMes(dados.mes)}
            </h2>
            <p className="mt-1 max-w-[52rem] text-xs leading-relaxed text-platform-text-muted">
              {t(
                "What Vini answered in the month (Brasília time), and the space each brand takes up",
                "O que o Vini atendeu no mês (horário de Brasília) e o espaço que cada marca ocupa",
              )}
              {dados.fotografia
                ? t(`, as measured on ${diaCurto(dados.fotografia)}.`, `, na medição de ${diaCurto(dados.fotografia)}.`)
                : t(". Space hasn't been measured yet for this month.", ". O espaço ainda não foi medido neste mês.")}
            </p>
            {dados.marcas.length === 0 ? (
              <p className="mt-3 text-sm text-platform-text-muted">{t("This account has no brands yet.", "Esta conta ainda não tem marcas.")}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table data-tabela-consumo className="w-full min-w-[48rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-platform-border text-[11px] uppercase tracking-wider text-platform-text-muted">
                      <th className={TH}>{t("Brand", "Marca")}</th>
                      <th className={TH}>{t("Questions", "Perguntas")}</th>
                      <th className={TH}>{t("Reviews", "Análises")}</th>
                      <th className={TH}>{t("Prompts", "Prompts")}</th>
                      <th className={TH}>{t("Manuals", "Manuais")}</th>
                      <th className={TH}>{t("Materials", "Materiais")}</th>
                      <th className={TH}>{t("Reviewed pieces", "Peças analisadas")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.marcas.map((m) => (
                      <tr key={m.id ?? "sem-marca"} data-marca={m.id ?? "sem-marca"} className="border-b border-platform-border text-platform-text">
                        <td className="py-2 pr-4">
                          {m.nome}
                          {m.pausada && <span data-marca-pausada className="ml-2 border border-platform-border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">{t("Vini paused", "Vini pausado")}</span>}
                        </td>
                        <td className={TD}>{milhares(m.perguntas)}</td>
                        <td className={TD}>{milhares(m.analises)}</td>
                        <td className={TD}>{milhares(m.prompts)}</td>
                        <td className={TD}>{tamanho(m.manuais_bytes)}</td>
                        <td className={TD}>{tamanho(m.materiais_bytes)}</td>
                        <td className={TD}>{tamanho(m.pecas_bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr data-total className="font-bold text-platform-text">
                      <td className="py-2 pr-4">{t("Total", "Total")}</td>
                      <td className={TD}>{milhares(dados.totais.perguntas)}</td>
                      <td className={TD}>{milhares(dados.totais.analises)}</td>
                      <td className={TD}>{milhares(dados.totais.prompts)}</td>
                      <td className={TD}>{tamanho(dados.totais.manuais_bytes)}</td>
                      <td className={TD}>{tamanho(dados.totais.materiais_bytes)}</td>
                      <td className={TD}>{tamanho(dados.totais.pecas_bytes)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function CartaoDoTeto({ teto, t }: { teto: Teto; t: (en: string, pt: string) => string }) {
  const dia = teto.periodo === "dia";
  const largura = Math.min(teto.pct, 100);
  return (
    <div data-teto={teto.periodo} data-estado={teto.estado} className="border border-platform-border p-4">
      <p className={ROTULO}>{dia ? t("Today", "Hoje") : t("This month", "Este mês")}</p>
      <p className="font-display text-2xl font-black text-platform-text">
        {teto.pct}%<span className="ml-2 text-sm font-normal text-platform-text-muted">{dia ? t("of the daily limit", "do limite do dia") : t("of the monthly limit", "do limite do mês")}</span>
      </p>
      <div className="mt-3 h-1.5 w-full bg-platform-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={largura}
        aria-label={dia ? t("Daily limit used", "Limite do dia usado") : t("Monthly limit used", "Limite do mês usado")}>
        <div className="h-full bg-platform-text" style={{ width: `${largura}%` }} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-platform-text-muted">
        {teto.estado === "esgotado"
          ? t("Limit reached: Vini turns down new requests until it renews.", "Limite atingido: o Vini recusa novos pedidos até renovar.")
          : teto.estado === "alerta"
            ? t("Close to the limit. At 100%, Vini turns down new requests until it renews.", "Perto do limite. Ao chegar a 100%, o Vini recusa novos pedidos até renovar.")
            : ""}
        {teto.estado !== "ok" ? " " : ""}
        {dia
          ? t("Renews at midnight UTC (9 p.m. in Brasília).", "Renova à 0h UTC (21h em Brasília).")
          : t("Renews on the 1st at midnight UTC (9 p.m. on the last day of the month in Brasília).", "Renova no dia 1º à 0h UTC (21h do último dia do mês, em Brasília).")}
      </p>
    </div>
  );
}
