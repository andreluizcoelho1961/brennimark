/**
 * A ordem do download de um KIT — fatia 5.
 *
 * A mesma de `liberarDownload` (um arquivo), para vários: buscar → conferir o
 * caminho de CADA arquivo → assinar todos → registrar todos → só então
 * entregar os endereços. Kit que não se registra não sai; arquivo com caminho
 * fora da marca não entra (e não derruba os outros).
 *
 * Os bytes não passam pela função: o navegador busca cada endereço assinado e
 * monta o ZIP (spec de Materiais §9 — sem estourar o teto de 4 MiB por
 * resposta, sem segunda cópia no Storage).
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import type { Eixos } from "./eixos";
import { MAXIMO_DO_KIT, caminhosNoKit, nomeDoKit } from "./kit";

export type ArquivoDoKit = { id: string; storagePath: string; fileName: string; eixos: Eixos };

export type ResultadoDoKit =
  | { tipo: "emitir"; nome: string; arquivos: { url: string; caminho: string }[] }
  | { tipo: "vazio" }
  | { tipo: "nao-encontrado" }
  | { tipo: "falha"; etapa: "busca" | "assinatura" | "registro" };

export async function liberarKit(deps: {
  marca: string;
  buscar: () => Promise<{ ok: true; item: { nome: string } | null; arquivos: ArquivoDoKit[] } | { ok: false }>;
  pertenceAMarca: (storagePath: string) => boolean;
  assinar: (caminhos: string[]) => Promise<Map<string, string> | null>;
  registrar: (ids: string[]) => Promise<boolean>;
}): Promise<ResultadoDoKit> {
  const busca = await deps.buscar();
  if (!busca.ok) return { tipo: "falha", etapa: "busca" };
  if (!busca.item) return { tipo: "nao-encontrado" };

  const servidos = busca.arquivos.filter((a) => deps.pertenceAMarca(a.storagePath)).slice(0, MAXIMO_DO_KIT);
  if (servidos.length === 0) return { tipo: "vazio" };

  const enderecos = await deps.assinar(servidos.map((a) => a.storagePath));
  // Assinatura parcial é falha inteira: um kit com buraco pareceria completo.
  if (!enderecos || servidos.some((a) => !enderecos.get(a.storagePath))) return { tipo: "falha", etapa: "assinatura" };

  if (!(await deps.registrar(servidos.map((a) => a.id)))) return { tipo: "falha", etapa: "registro" };

  const nome = nomeDoKit(deps.marca, busca.item.nome);
  const caminhos = caminhosNoKit(nome, servidos);
  return {
    tipo: "emitir",
    nome,
    arquivos: servidos.map((a) => ({ url: enderecos.get(a.storagePath)!, caminho: caminhos.get(a.id)! })),
  };
}
