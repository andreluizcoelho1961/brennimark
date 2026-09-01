"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";

/**
 * A conta e a marca da URL, para o cliente.
 *
 * Toda chamada de API precisa dizer em qual marca ela opera. Antes não
 * precisava porque só havia uma — e "só havia uma" era o defeito. Sem este
 * parâmetro, uma conta com duas marcas recebe 409 do servidor, que é o
 * comportamento correto e inútil se o cliente nunca informa qual.
 *
 * Lê de `useParams` e não de um provider: a URL já é a fonte de verdade do
 * contexto ativo, e um provider seria uma segunda cópia dela — com a chance de
 * discordar durante uma navegação.
 */
export function useAlvo(): { workspaceSlug?: string; brandKey?: string } {
  const params = useParams();
  const um = (valor: unknown) => (typeof valor === "string" ? valor : undefined);
  const workspaceSlug = um(params?.workspaceSlug);
  const brandKey = um(params?.brandKey);
  // Memorizado pelos dois valores, não pelo objeto de params.
  //
  // Sem isto, cada render devolveria um objeto novo, e todo `useEffect` que
  // dependesse do alvo dispararia de novo — buscando em laço. Com deps vazias
  // em vez disso, o oposto: trocar de marca não refaria busca nenhuma, e a
  // tela continuaria mostrando os dados da marca anterior. As duas saídas
  // erradas se resolvem aqui, uma vez, em vez de em cada tela.
  return useMemo(() => ({ workspaceSlug, brandKey }), [workspaceSlug, brandKey]);
}

/**
 * Acrescenta o alvo a uma URL de API, preservando o que já houver de query.
 *
 * Fora do contexto — preview local, rota de comparação — devolve a URL
 * intocada, e o servidor resolve pela conta única. Inventar um alvo aqui seria
 * a mesma escolha silenciosa, só que do lado do cliente.
 */
export function comAlvo(
  url: string,
  alvo: { workspaceSlug?: string; brandKey?: string },
): string {
  if (!alvo.workspaceSlug || !alvo.brandKey) return url;
  const separador = url.includes("?") ? "&" : "?";
  return `${url}${separador}w=${encodeURIComponent(alvo.workspaceSlug)}&b=${encodeURIComponent(alvo.brandKey)}`;
}
