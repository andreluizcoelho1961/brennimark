"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { DESTINO_PADRAO } from "@/platform/destino-de-retorno";

/**
 * A porta entre o site e a plataforma.
 *
 * Quem ainda não entrou vê "Entrar" e vai ao login. Quem já tem sessão vê
 * "Abrir a plataforma" e vai direto ao produto.
 *
 * A sessão é percebida pelo cookie do Supabase (`sb-…-auth-token`), que o
 * navegador enxerga. Isto só decide o RÓTULO: quem autoriza é o `proxy`, no
 * servidor. Um cookie vencido mostra "Abrir a plataforma" e o `proxy` manda ao
 * login do mesmo jeito — o pior caso é uma palavra errada, nunca um acesso.
 *
 * O servidor sempre desenha "Entrar" (o terceiro argumento do
 * `useSyncExternalStore`); a troca acontece no navegador, para a página
 * continuar sendo gerada no deploy, igual para todos.
 *
 * A passagem para a plataforma recarrega a página (o site e o produto têm raízes
 * de layout diferentes), e o site sai inteiro da memória antes de a moldura do
 * produto entrar. Pelo `<Link>` o Next faz isso sozinho; o pré-carregamento
 * fica desligado para o site não pedir `/login` ao servidor em segundo plano.
 */
const COOKIE_DE_SESSAO = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/;

export function EntrarOuAbrir({ className, rotulo }: { className: string; rotulo?: string }) {
  const t = useTranslations("site.chrome");
  const comSessao = useSyncExternalStore(
    semAssinatura,
    () => COOKIE_DE_SESSAO.test(document.cookie),
    () => false,
  );

  return comSessao ? (
    <a className={className} href={DESTINO_PADRAO} data-porta="plataforma">
      {t("abrirPlataforma")}
    </a>
  ) : (
    <Link className={className} href="/login" prefetch={false} data-porta="entrar">
      {rotulo ?? t("entrar")}
    </Link>
  );
}

/** O cookie não avisa quando muda; basta a leitura de quando a página abre. */
function semAssinatura() {
  return () => {};
}
