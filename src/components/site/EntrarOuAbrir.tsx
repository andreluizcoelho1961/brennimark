"use client";

import { useSyncExternalStore } from "react";
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
 * É um `<a>` comum, não `next/link`: a passagem para a plataforma recarrega a
 * página, e o site sai inteiro da memória antes de a moldura do produto entrar.
 */
const COOKIE_DE_SESSAO = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/;

export function EntrarOuAbrir({ className, rotulo = "Entrar" }: { className: string; rotulo?: string }) {
  const comSessao = useSyncExternalStore(
    semAssinatura,
    () => COOKIE_DE_SESSAO.test(document.cookie),
    () => false,
  );

  return comSessao ? (
    <a className={className} href={DESTINO_PADRAO} data-porta="plataforma">
      Abrir a plataforma
    </a>
  ) : (
    <a className={className} href="/login" data-porta="entrar">
      {rotulo}
    </a>
  );
}

/** O cookie não avisa quando muda; basta a leitura de quando a página abre. */
function semAssinatura() {
  return () => {};
}
