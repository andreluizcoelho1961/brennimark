import type { DocPageEntry, DocStatus } from "./docs";
import type { BrandCapability } from "../platform/capabilities";

/**
 * Quem enxerga qual página do manual.
 *
 * DECISÃO EDITORIAL, tomada de propósito e não herdada da consulta.
 *
 * **Quem consulta vê tudo — `ready`, `draft` e `pending` — sempre rotulado.**
 *
 * O motivo é o desenho do produto, não conveniência. Toda importação nasce
 * inteira em `draft`: é a regra do importador, e existe para que ninguém
 * publique como norma um texto que uma máquina extraiu de um PDF. Se `member`
 * só enxergasse `ready`, um manual recém-importado seria invisível para toda a
 * equipe até alguém promover as 152 seções uma a uma. O produto entregaria uma
 * conta vazia no dia seguinte à importação, que é o dia em que ele mais precisa
 * provar que funciona.
 *
 * E esconder é a resposta errada para o problema certo. O problema é uma
 * pessoa tomar rascunho por regra. A solução do produto para isso é o RÓTULO:
 * a página diz o status, o assistente diz o status na citação, e as regras de
 * fundamentação obrigam a tratar `draft` como provisório. Esconder trocaria
 * "você leu algo provisório e sabia disso" por "você não achou nada e concluiu
 * que não existe regra" — e a segunda é pior, porque ela não avisa.
 *
 * `pending` também aparece: ele significa "ainda não há regra aqui", e essa é
 * uma informação útil. Uma página pendente encontrada é uma decisão que falta
 * tomar; uma página pendente escondida é uma pergunta que volta amanhã.
 *
 * O que NÃO segue desta decisão: rascunho não vira regra em lugar nenhum. Ele
 * é visível e continua marcado como provisório em toda superfície.
 *
 * Se um dia um cliente exigir manual só com o aprovado, isso vira configuração
 * DA MARCA — um campo em `navigation`, decidido por quem instala — e não um
 * comportamento fixo do produto. Não é o caso hoje, e inventar a configuração
 * antes de existir o caso seria inventar requisito.
 */
export const STATUS_VISIVEIS: readonly DocStatus[] = ["ready", "draft", "pending"];

export function podeVerDocumento(
  status: DocStatus,
  capabilities: readonly BrandCapability[],
): boolean {
  // Sem capacidade de consultar, nenhuma página — nem as prontas.
  if (!capabilities.includes("consultar")) return false;
  return STATUS_VISIVEIS.includes(status);
}

export function documentosVisiveis(
  docs: readonly DocPageEntry[],
  capabilities: readonly BrandCapability[],
): DocPageEntry[] {
  return docs.filter((doc) => podeVerDocumento(doc.status, capabilities));
}
