"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { caminhoDoSite, idiomaDoSiteValido, IDIOMA_PADRAO_DO_SITE } from "@/lib/site/idiomas";

export type PlanoAVenda = { codigo: string; nome: string; maximoDeMarcas: number | null };

type Moeda = "BRL" | "USD";
/** Os rótulos de cada moeda vêm do catálogo (`cobranca.formulario.brasil` / `outros`). */
const MOEDAS: { valor: Moeda; chave: "brasil" | "outros" }[] = [
  { valor: "BRL", chave: "brasil" },
  { valor: "USD", chave: "outros" },
];

const CAMPO = "w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal";
const ROTULO = "mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted";

/**
 * O pedido de assinatura: plano, moeda e quem assina. Enviar abre a página de
 * pagamento do Stripe — nada é cobrado aqui, e nenhum dado de cartão passa
 * pelo Brennimark.
 */
export function FormularioDeAssinatura({ planos, planoInicial }: { planos: PlanoAVenda[]; planoInicial: string | null }) {
  const t = useTranslations("cobranca.formulario");
  const lang = useLocale();
  const idioma = idiomaDoSiteValido(lang) ? lang : IDIOMA_PADRAO_DO_SITE;
  const [plano, setPlano] = useState(planos.some((p) => p.codigo === planoInicial) ? planoInicial! : planos[0]?.codigo ?? "");
  // Quem lê em inglês começa na moeda em dólar (a mudança é um clique).
  const [moeda, setMoeda] = useState<Moeda>(idioma === "en" ? "USD" : "BRL");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  if (planos.length === 0) {
    return (
      <p data-assinatura-fechada className="mt-10 border-t border-platform-border pt-6 text-sm text-platform-text-muted">
        {t("fechada")}
      </p>
    );
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    const dados = new FormData(e.currentTarget);
    const resposta = await fetch("/api/cobranca/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plano, moeda, nome: dados.get("nome"), email: dados.get("email"), empresa: dados.get("empresa"), idioma }),
    }).catch(() => null);
    const corpo = await resposta?.json().catch(() => null);
    if (resposta?.ok && typeof corpo?.url === "string") {
      window.location.assign(corpo.url);
      return;
    }
    setEnviando(false);
    setErro(typeof corpo?.message === "string" ? corpo.message : t("erro"));
  }

  return (
    <form onSubmit={enviar} noValidate data-formulario-de-assinatura className="mt-10 flex flex-col gap-8">
      <fieldset>
        <legend className={ROTULO}>{t("plano")}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {planos.map((p) => (
            <label key={p.codigo} data-plano={p.codigo}
              className={`cursor-pointer border px-4 py-4 ${plano === p.codigo ? "border-platform-signal" : "border-platform-border"}`}>
              <input type="radio" name="plano" value={p.codigo} checked={plano === p.codigo} onChange={() => setPlano(p.codigo)} className="sr-only" />
              <span className="block font-display text-sm font-black uppercase text-platform-text">{p.nome}</span>
              <span className="mt-1 block text-xs text-platform-text-muted">
                {p.maximoDeMarcas === null ? t("marcasSemLimite") : t("ateMarcas", { n: p.maximoDeMarcas })}{t("pessoas")}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={ROTULO}>{t("ondeFica")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {MOEDAS.map((m) => (
            <label key={m.valor} data-moeda={m.valor}
              className={`cursor-pointer border px-4 py-3 ${moeda === m.valor ? "border-platform-signal" : "border-platform-border"}`}>
              <input type="radio" name="moeda" value={m.valor} checked={moeda === m.valor} onChange={() => setMoeda(m.valor)} className="sr-only" />
              <span className="block text-sm font-bold text-platform-text">{t(m.chave)}</span>
              <span className="block text-xs text-platform-text-muted">{t("cartao")}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nome" className={ROTULO}>{t("nome")}</label>
          <input id="nome" name="nome" required autoComplete="name" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="email" className={ROTULO}>{t("email")}</label>
          <input id="email" name="email" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} className={CAMPO} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="empresa" className={ROTULO}>{t("empresa")}</label>
          <input id="empresa" name="empresa" required autoComplete="organization" className={CAMPO} aria-describedby="empresa-ajuda" />
          <p id="empresa-ajuda" className="mt-1.5 text-xs text-platform-text-muted">{t("empresaAjuda")}</p>
        </div>
      </div>

      <p className="border-l-2 border-platform-signal pl-3 text-sm leading-relaxed text-platform-text" data-aviso-de-renovacao>
        {t("renovacao")}
      </p>

      <p className="text-xs leading-relaxed text-platform-text-muted" data-aceite-dos-termos>
        {t.rich("aceite", {
          t: (c) => <a href={caminhoDoSite(idioma, "/termos")} target="_blank" rel="noopener" className="underline">{c}</a>,
          p: (c) => <a href={caminhoDoSite(idioma, "/privacidade")} target="_blank" rel="noopener" className="underline">{c}</a>,
        })}
      </p>

      <div>
        <button type="submit" disabled={enviando} data-ir-ao-pagamento
          className="border border-platform-signal px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50">
          {enviando ? t("abrindo") : t("ir")}
        </button>
        {erro && <p role="alert" data-erro-da-assinatura className="mt-3 text-sm text-platform-text">{erro}</p>}
      </div>
    </form>
  );
}
