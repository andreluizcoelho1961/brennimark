/**
 * "Baixar todos os materiais da marca" — 03/11/2026.
 *
 * A mesma ordem do kit de um item (buscar → conferir o caminho de CADA arquivo
 * → assinar todos → registrar todos → só então entregar os endereços), para a
 * marca inteira: o que está EM USO, de cada item, menos fotos e ilustrações
 * (que moram no Banco de imagens, com download próprio).
 *
 * O ZIP se organiza por tipo e por item:
 *
 *   acme-materiais/
 *   ├── LEIA-ME.txt
 *   ├── logo/logotipo/principal/horizontal/colorido-positivo-rgb/logo.svg
 *   └── fonte/inter/Inter-Regular.ttf   (+ LEIA-ME.txt com a licença)
 *
 * Os bytes não passam pela função: o navegador busca cada endereço e monta o
 * ZIP. Por isso há dois tetos — de arquivos e de bytes — e a recusa DIZ qual
 * e manda baixar por item, em vez de entregar um pedaço que parece o todo.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import type { Eixos } from "./eixos";
import { caminhosNoKit, segmentoSeguro } from "./kit";
import { leiaMeDaMarca, leiaMeDeFontes, type LicencaDoItem } from "./fonte";

export const MAXIMO_DA_MARCA = 300;
export const TETO_DA_MARCA_BYTES = 400 * 1024 * 1024;

export type ItemDaMarca = { id: string; nome: string; tipo: string; licenca: LicencaDoItem | null };
export type ArquivoDaMarca = { id: string; itemId: string; storagePath: string; fileName: string; tamanho: number; eixos: Eixos };

export type ResultadoDaMarca =
  | { tipo: "emitir"; nome: string; arquivos: { url: string; caminho: string }[]; extras: { caminho: string; texto: string }[] }
  | { tipo: "vazio" }
  | { tipo: "grande-demais"; total: number; maximo: number }
  | { tipo: "pesado-demais"; bytes: number; maximo: number }
  | { tipo: "falha"; etapa: "busca" | "assinatura" | "registro" };

export async function liberarMarca(deps: {
  marca: string;
  ingles: boolean;
  buscar: () => Promise<{ ok: true; itens: ItemDaMarca[]; arquivos: ArquivoDaMarca[] } | { ok: false }>;
  pertenceAMarca: (storagePath: string) => boolean;
  assinar: (caminhos: string[]) => Promise<Map<string, string> | null>;
  registrar: (ids: string[]) => Promise<boolean>;
}): Promise<ResultadoDaMarca> {
  const busca = await deps.buscar();
  if (!busca.ok) return { tipo: "falha", etapa: "busca" };

  const servidos = busca.arquivos.filter((a) => deps.pertenceAMarca(a.storagePath));
  if (servidos.length === 0) return { tipo: "vazio" };
  if (servidos.length > MAXIMO_DA_MARCA) return { tipo: "grande-demais", total: servidos.length, maximo: MAXIMO_DA_MARCA };
  const bytes = servidos.reduce((soma, a) => soma + a.tamanho, 0);
  if (bytes > TETO_DA_MARCA_BYTES) return { tipo: "pesado-demais", bytes, maximo: TETO_DA_MARCA_BYTES };

  const enderecos = await deps.assinar(servidos.map((a) => a.storagePath));
  // Assinatura parcial é falha inteira: um kit com buraco pareceria completo.
  if (!enderecos || servidos.some((a) => !enderecos.get(a.storagePath))) return { tipo: "falha", etapa: "assinatura" };
  if (!(await deps.registrar(servidos.map((a) => a.id)))) return { tipo: "falha", etapa: "registro" };

  const raiz = `${segmentoSeguro(deps.marca, "marca")}-materiais`;
  const usadas = new Set<string>();
  const caminhoDe = new Map<string, string>();
  const pastas: { pasta: string; arquivos: number }[] = [];
  const extras: { caminho: string; texto: string }[] = [];
  const fontes: { item: string; licenca: LicencaDoItem | null }[] = [];

  for (const item of busca.itens) {
    const doItem = servidos.filter((a) => a.itemId === item.id);
    if (doItem.length === 0) continue;
    const relativos = caminhosNoKit(item.nome, doItem.map((a) => ({ id: a.id, fileName: a.fileName, eixos: a.eixos })));
    const tipoDir = segmentoSeguro(item.tipo, "material");
    for (const a of doItem) {
      // `relativos` já vem como `<item>/<eixos>/<arquivo>`; o tipo e a raiz vão na frente.
      let caminho = `${raiz}/${tipoDir}/${relativos.get(a.id)!}`;
      for (let n = 2; usadas.has(caminho); n += 1) caminho = caminho.replace(/(\.[^./]+)?$/, `-${n}$1`);
      usadas.add(caminho);
      caminhoDe.set(a.id, caminho);
    }
    const pastaDoItem = `${tipoDir}/${segmentoSeguro(item.nome, "item")}`;
    pastas.push({ pasta: pastaDoItem, arquivos: doItem.length });
    if (item.tipo === "fonte") {
      fontes.push({ item: item.nome, licenca: item.licenca });
      extras.push({
        caminho: `${raiz}/${pastaDoItem}/LEIA-ME.txt`,
        texto: leiaMeDeFontes({ marca: deps.marca, item: item.nome, arquivos: doItem.map((a) => a.fileName), licenca: item.licenca, ingles: deps.ingles }),
      });
    }
  }
  extras.unshift({ caminho: `${raiz}/LEIA-ME.txt`, texto: leiaMeDaMarca({ marca: deps.marca, pastas, fontes, ingles: deps.ingles }) });

  return {
    tipo: "emitir",
    nome: `${raiz}.zip`,
    arquivos: servidos.map((a) => ({ url: enderecos.get(a.storagePath)!, caminho: caminhoDe.get(a.id)! })),
    extras,
  };
}
