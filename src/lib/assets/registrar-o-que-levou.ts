/**
 * O registro do que a pessoa LEVOU no Kit e nos Grids (03/11/2026).
 *
 * Essas ferramentas montam o arquivo no navegador (ZIP, PDF, IDML) a partir de
 * originais que já vieram da rota do kit como `previa`. A linha de `download`
 * em Registros não nascia: o clique em "Baixar" nunca passava pelo servidor.
 *
 * Agora o clique pede a mesma rota com `finalidade: "download"`, ANTES de
 * montar o arquivo, e a montagem só segue se o registro nasceu — a ordem do
 * ADR-0007 (registrar, depois entregar) vale também aqui. Dois limites, ditos
 * para não prometer demais: o registro é do clique e não do fim do arquivo
 * (ele é construído no navegador), e lista as versões escolhidas, não
 * necessariamente cada arquivo que entrou no ZIP.
 *
 * A rota exige um único item por pedido; versões de itens diferentes viram
 * pedidos diferentes.
 */
export type VersaoLevada = { id: string; itemId: string };

type Buscar = (endereco: string, init: RequestInit) => Promise<Pick<Response, "ok" | "json">>;

/** Devolve "" quando todas as linhas nasceram, ou o motivo a mostrar. */
export async function registrarOQueLevou(
  versoes: VersaoLevada[],
  opcoes: { endereco: string; padrao: string; buscar?: Buscar },
): Promise<string> {
  const porItem = new Map<string, Set<string>>();
  for (const v of versoes) {
    const ids = porItem.get(v.itemId) ?? new Set<string>();
    ids.add(v.id);
    porItem.set(v.itemId, ids);
  }
  const buscar = opcoes.buscar ?? ((e, i) => fetch(e, i));
  for (const [itemId, ids] of porItem) {
    let resposta: Awaited<ReturnType<Buscar>> | null = null;
    try {
      resposta = await buscar(opcoes.endereco, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, ids: [...ids], finalidade: "download" }),
      });
    } catch { /* cai na mensagem padrão */ }
    if (!resposta?.ok) {
      const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
      return typeof corpo?.message === "string" && corpo.message ? corpo.message : opcoes.padrao;
    }
  }
  return "";
}
