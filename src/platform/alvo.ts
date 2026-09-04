/**
 * O alvo — conta e marca — numa URL de API. Módulo PURO.
 *
 * Separado de `alvo-client.tsx` porque aquele arquivo é um componente de
 * cliente: tem `"use client"` e o hook `useAlvo`, que depende do roteador.
 * Esta função não depende de nada disso, e a suíte de testes do projeto é
 * deliberadamente pura — sem React, sem JSX, sem DOM. Manter a regra aqui é
 * o que torna a montagem da URL testável sem subir a aplicação inteira.
 *
 * `alvo-client.tsx` reexporta `comAlvo`, então quem já importava de lá
 * continua funcionando sem mudar nada.
 */

/**
 * Acrescenta o alvo a uma URL de API, preservando o que já houver de query.
 *
 * Fora do contexto — preview local, rota de comparação — devolve a URL
 * intocada, e o servidor resolve pela conta única. Inventar um alvo aqui seria
 * a mesma escolha silenciosa, só que do lado do cliente.
 *
 * `w` e `b` são anexados de forma INDEPENDENTE, não em bloco.
 *
 * A regra anterior descartava os DOIS quando faltava UM. Isso é seguro
 * enquanto toda tela que chama daqui vive sob `[brandKey]` — que é o caso
 * hoje, e por isso esta correção é PREVENTIVA: nenhum chamador atual muda
 * de comportamento, e nenhum defeito visível é consertado agora.
 *
 * O que ela impede: uma tela escopada só na CONTA (sem marca na URL)
 * chamando uma API de conta — `/api/ai/settings`, `/api/ai/routing` — sairia
 * sem `w` nenhum. `workspaceDaRota` (`contexto-da-rota.ts`) então cai no
 * palpite de "resolve se houver só uma conta", e devolve 409
 * `workspace_ambiguo` para quem tem duas. O defeito só aparece com dois
 * workspaces, que é justamente a configuração que ninguém tem em
 * desenvolvimento — ele nasceria em produção, na conta de uma agência com
 * mais de um cliente.
 *
 * Continua verdade que meio alvo não vira alvo: `alvoDaRota` exige os dois
 * para montar um `Alvo`, então mandar só `w` não faz rota de marca nenhuma
 * resolver por engano.
 */
export function comAlvo(
  url: string,
  alvo: { workspaceSlug?: string; brandKey?: string },
): string {
  const params = new URLSearchParams();
  if (alvo.workspaceSlug) params.set("w", alvo.workspaceSlug);
  if (alvo.brandKey) params.set("b", alvo.brandKey);
  const query = params.toString();
  if (!query) return url;
  const separador = url.includes("?") ? "&" : "?";
  return `${url}${separador}${query}`;
}
