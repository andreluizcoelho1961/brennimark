"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";

type Situacao = { acesso: string; soLeituraAPartirDe: string | null; administra: boolean; conta: string };

/**
 * O aviso de cobrança na moldura (01/10/2026). Só aparece quando a assinatura
 * da conta está em atraso: na tolerância (tudo funciona, até uma data) ou em
 * só leitura. Quem administra recebe o caminho para regularizar; os outros, a
 * explicação de por que o Vini e a edição pararam.
 *
 * Sem conta na URL (bancadas, telas fora de conta), não pergunta nada.
 */
export function AvisoDaCobranca() {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const [s, setS] = useState<Situacao | null>(null);

  useEffect(() => {
    if (!alvo.workspaceSlug) return;
    let cancelado = false;
    (async () => {
      const r = await fetch(comAlvo("/api/cobranca/situacao", alvo), { cache: "no-store" }).catch(() => null);
      const d = r?.ok ? await r.json().catch(() => null) : null;
      if (!cancelado) setS(d);
    })();
    return () => { cancelado = true; };
  }, [alvo]);

  if (!s || (s.acesso !== "tolerancia" && s.acesso !== "so_leitura")) return null;
  const ate = s.soLeituraAPartirDe
    ? new Intl.DateTimeFormat(isEnglish ? "en-US" : "pt-BR", { day: "numeric", month: "long" }).format(new Date(s.soLeituraAPartirDe))
    : "";

  return (
    <div data-aviso-da-cobranca={s.acesso} role="status"
      className="mx-auto mb-3 flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-1 border-l-2 border-platform-text bg-platform-panel px-4 py-2 text-sm text-platform-text">
      <span className="font-bold">
        {s.acesso === "tolerancia"
          ? t(`The subscription payment is overdue. Everything works until ${ate}.`, `O pagamento da assinatura está em atraso. Tudo funciona até ${ate}.`)
          : t("This account is read-only: the subscription is overdue. Reading and downloads keep working.",
              "Esta conta está só para leitura: a assinatura está em atraso. Consulta e downloads continuam.")}
      </span>
      {s.administra ? (
        <Link href={`/w/${s.conta}/configuracoes?parte=plano`} className="underline">{t("Settle the payment", "Regularizar o pagamento")}</Link>
      ) : (
        <span className="text-platform-text-muted">{t("The account administrator can settle it.", "Quem administra a conta pode regularizar.")}</span>
      )}
    </div>
  );
}
