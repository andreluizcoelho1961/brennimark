"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { caminhoDoSite, idiomaDoSiteValido, IDIOMA_PADRAO_DO_SITE } from "@/lib/site/idiomas";
import { FAIXAS_DA_VITRINE, precoDaVitrine, type FaixaDaVitrine, type PlanoDaVitrine } from "@/lib/site/vitrine-de-planos";

export type PlanoAVenda = { codigo: string; nome: string; maximoDeMarcas: number | null };

type Moeda = "BRL" | "USD";
/** Os rótulos de cada moeda vêm do catálogo (`cobranca.formulario.brasil` / `outros`). */
const MOEDAS: { valor: Moeda; chave: "brasil" | "outros" }[] = [
  { valor: "BRL", chave: "brasil" },
  { valor: "USD", chave: "outros" },
];
/**
 * Moedas que a tela oferece. Cada plano da escada tem um preço em reais e um em
 * dólar no Stripe (registrados em Console › Cobrança, 11/11/2026). Um plano sem
 * preço na moeda escolhida é recusado pelo servidor com uma frase; para fechar
 * uma moeda de novo, tire-a desta lista — com uma só moeda a escolha some da tela.
 */
const MOEDAS_ABERTAS: Moeda[] = ["BRL", "USD"];

const CAMPO = "w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal";
const ROTULO = "mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted";

/** Os dois blocos da escolha: o plano com o Vini da plataforma e o de chave própria. */
const GRUPOS = [
  { chave: "comIa", titulo: "grupoComIa" },
  { chave: "propria", titulo: "grupoPropria" },
] as const;

/**
 * Um plano como cartão. Os da escada levam o nome da faixa e o preço (o mesmo
 * que a vitrine mostra); um plano fora da escada cai no nome que o banco dá.
 */
function CartaoDoPlano({ p, faixa, preco, moeda, marcado, onEscolher }: { p: PlanoAVenda; faixa?: FaixaDaVitrine; preco?: PlanoDaVitrine; moeda: Moeda; marcado: boolean; onEscolher: () => void }) {
  const t = useTranslations("cobranca.formulario");
  const tSite = useTranslations("site.home");
  return (
    <label data-plano={p.codigo} className={`cursor-pointer border px-4 py-4 ${marcado ? "border-platform-signal" : "border-platform-border"}`}>
      <input type="radio" name="plano" value={p.codigo} checked={marcado} onChange={onEscolher} className="sr-only" />
      <span className="block font-display text-sm font-black uppercase text-platform-text">{faixa ? tSite(`faixa_${faixa.id}`) : p.nome}</span>
      {preco && <span data-preco-do-plano className="mt-1 block text-sm font-bold text-platform-text">{t("precoPorMes", { preco: precoDaVitrine(preco, moeda) })}</span>}
      <span className="mt-1 block text-xs text-platform-text-muted">
        {p.maximoDeMarcas === null ? t("marcasSemLimite") : t("ateMarcas", { n: p.maximoDeMarcas })}{t("pessoas")}
      </span>
    </label>
  );
}

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
  const [moeda, setMoeda] = useState<Moeda>(idioma === "en" && MOEDAS_ABERTAS.includes("USD") ? "USD" : "BRL");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const codigosDaVitrine = new Set(FAIXAS_DA_VITRINE.flatMap((f) => [f.comIa.codigo, f.propria.codigo]));
  const soltos = planos.filter((p) => !codigosDaVitrine.has(p.codigo));

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
      <fieldset className="flex flex-col gap-6">
        <legend className={ROTULO}>{t("plano")}</legend>
        {GRUPOS.map((g) => (
          <div key={g.chave} data-grupo-de-planos={g.chave}>
            <p className="mb-2 text-sm font-bold text-platform-text">{t(g.titulo)}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {FAIXAS_DA_VITRINE.map((faixa) => {
                const p = planos.find((x) => x.codigo === faixa[g.chave].codigo);
                return p ? <CartaoDoPlano key={p.codigo} p={p} faixa={faixa} preco={faixa[g.chave]} moeda={moeda} marcado={plano === p.codigo} onEscolher={() => setPlano(p.codigo)} /> : null;
              })}
            </div>
          </div>
        ))}
        {soltos.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {soltos.map((p) => <CartaoDoPlano key={p.codigo} p={p} moeda={moeda} marcado={plano === p.codigo} onEscolher={() => setPlano(p.codigo)} />)}
          </div>
        )}
      </fieldset>

      {MOEDAS_ABERTAS.length > 1 && (
        <fieldset>
          <legend className={ROTULO}>{t("ondeFica")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {MOEDAS.filter((m) => MOEDAS_ABERTAS.includes(m.valor)).map((m) => (
              <label key={m.valor} data-moeda={m.valor}
                className={`cursor-pointer border px-4 py-3 ${moeda === m.valor ? "border-platform-signal" : "border-platform-border"}`}>
                <input type="radio" name="moeda" value={m.valor} checked={moeda === m.valor} onChange={() => setMoeda(m.valor)} className="sr-only" />
                <span className="block text-sm font-bold text-platform-text">{t(m.chave)}</span>
                <span className="block text-xs text-platform-text-muted">{t("cartao")}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

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
