"use client";

import { useEffect, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import type { PlanoDaConta } from "@/lib/cobranca/plano-da-conta";

const TITULO = "font-display text-sm font-black uppercase tracking-wider text-platform-text";
const DT = "text-[11px] uppercase tracking-wide text-platform-text-muted";
const BOTAO = "border border-platform-signal px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50";

/**
 * Configurações › Plano (cobrança, fatia 3, 01/10/2026): o plano da conta, a
 * situação do pagamento, as marcas usadas do limite, e o botão que abre o
 * Portal do Stripe — onde se troca o cartão, muda de plano, cancela e baixa
 * as faturas. Nenhum dado de cartão passa pelo Brennimark.
 */
export function Plano() {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const [dados, setDados] = useState<PlanoDaConta | null>(null);
  const [erro, setErro] = useState("");
  const [abrindo, setAbrindo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const resposta = await fetch(comAlvo("/api/configuracoes/plano", alvo), { cache: "no-store" }).catch(() => null);
      const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (resposta?.ok) setDados(corpo as PlanoDaConta);
      else setErro(corpo.message ?? t("Couldn't load the plan.", "Não foi possível carregar o plano."));
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo]);

  async function abrirPortal() {
    setAbrindo(true);
    setErro("");
    const resposta = await fetch(comAlvo("/api/cobranca/portal", alvo), { method: "POST" }).catch(() => null);
    const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
    if (resposta?.ok && typeof corpo.url === "string") { window.location.assign(corpo.url); return; }
    setAbrindo(false);
    setErro(corpo.message ?? t("Couldn't open the subscription page.", "Não foi possível abrir a página da assinatura."));
  }

  const data = (iso: string | null) => (iso ? new Intl.DateTimeFormat(isEnglish ? "en-US" : "pt-BR", { dateStyle: "long" }).format(new Date(iso)) : "—");

  if (erro && !dados) return <p role="alert" className="text-sm text-platform-text">{erro}</p>;
  if (!dados) return <p className="text-sm text-platform-text-muted">{t("Loading…", "Carregando…")}</p>;

  if (!dados.assinada) {
    return (
      <p data-sem-assinatura className="text-sm text-platform-text-muted">
        {t("This account was set up by the Brennimark team and has no online subscription. For plan questions, contact Brennimark.",
           "Esta conta foi aberta pela equipe da Brennimark e não tem assinatura online. Para assuntos de plano, fale com a Brennimark.")}
      </p>
    );
  }

  return (
    <div data-plano-da-conta className="space-y-8">
      {dados.acesso === "tolerancia" && (
        <p data-aviso-de-atraso role="status" className="border-l-2 border-platform-text pl-3 text-sm font-bold text-platform-text">
          {t(`The last payment didn't go through. Everything keeps working until ${data(dados.soLeituraAPartirDe)}; after that the account becomes read-only until the payment is settled.`,
             `O último pagamento não foi aprovado. Tudo continua funcionando até ${data(dados.soLeituraAPartirDe)}; depois, a conta fica só para leitura até o pagamento ser regularizado.`)}
        </p>
      )}
      {dados.acesso === "so_leitura" && (
        <p data-aviso-de-atraso role="status" className="border-l-2 border-platform-text pl-3 text-sm font-bold text-platform-text">
          {t("The account is read-only: people can read and download, but Vini, editing and new brands are paused. Nothing was deleted. Settle the payment to bring everything back.",
             "A conta está só para leitura: dá para consultar e baixar, mas o Vini, a edição e as marcas novas estão parados. Nada foi apagado. Regularize o pagamento para voltar tudo.")}
        </p>
      )}

      <section aria-labelledby="titulo-do-plano">
        <h2 id="titulo-do-plano" className={TITULO}>{t("Plan", "Plano")}</h2>
        <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className={DT}>{t("Plan", "Plano")}</dt><dd data-nome-do-plano className="font-bold text-platform-text">{dados.plano}</dd></div>
          <div>
            <dt className={DT}>{t("Brands", "Marcas")}</dt>
            <dd data-marcas-do-plano className="font-bold text-platform-text">
              {dados.marcas.maximo === null
                ? t(`${dados.marcas.usadas}, no limit`, `${dados.marcas.usadas}, sem limite`)
                : t(`${dados.marcas.usadas} of ${dados.marcas.maximo}`, `${dados.marcas.usadas} de ${dados.marcas.maximo}`)}
            </dd>
          </div>
          <div>
            <dt className={DT}>{dados.cancelaNoFim ? t("Ends on", "Termina em") : t("Paid through", "Pago até")}</dt>
            <dd data-pago-ate className="font-bold text-platform-text">{data(dados.pagoAte)}</dd>
          </div>
        </dl>
        {dados.cancelaNoFim && (
          <p data-cancela-no-fim className="mt-3 text-sm text-platform-text-muted">
            {t("The subscription was cancelled and ends at the end of the paid period. You can undo it on the subscription page.",
               "A assinatura foi cancelada e termina no fim do período pago. Dá para desfazer na página da assinatura.")}
          </p>
        )}
        {dados.marcas.maximo !== null && dados.marcas.usadas >= dados.marcas.maximo && (
          <p data-limite-de-marcas className="mt-3 text-sm text-platform-text-muted">
            {t("The account reached the plan's brand limit. To add brands, change the plan on the subscription page.",
               "A conta chegou ao limite de marcas do plano. Para acrescentar marcas, mude de plano na página da assinatura.")}
          </p>
        )}
      </section>

      <section aria-labelledby="titulo-da-gestao">
        <h2 id="titulo-da-gestao" className={TITULO}>{t("Subscription", "Assinatura")}</h2>
        <p className="mt-2 max-w-[40rem] text-sm text-platform-text-muted">
          {t(`Card, plan, cancellation and invoices are managed on Stripe's secure page. Billing contact: ${dados.titular}.`,
             `Cartão, plano, cancelamento e faturas ficam na página segura do Stripe. Contato da cobrança: ${dados.titular}.`)}
        </p>
        <button type="button" data-gerenciar-assinatura onClick={abrirPortal} disabled={abrindo} className={`${BOTAO} mt-4`}>
          {abrindo ? t("Opening…", "Abrindo…") : t("Manage subscription", "Gerenciar assinatura")}
        </button>
        {erro && <p role="alert" className="mt-3 text-sm text-platform-text">{erro}</p>}
      </section>
    </div>
  );
}
