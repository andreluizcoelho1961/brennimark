/**
 * O pacote da exportação (08/10/2026) — o que vai dentro de cada ZIP, e com
 * que nome. Termos, seção 13: "os arquivos originais e um índice do conteúdo".
 *
 * Um ZIP por marca (o navegador monta o ZIP na memória, e um único com o acervo
 * inteiro poderia travar o computador de quem exporta). Dentro:
 *
 *   manuais/                     os PDFs em vigor
 *   manuais/substituidos/        os que uma versão nova substituiu
 *   materiais/<item>/            os originais da biblioteca
 *   materiais/descontinuados/    os que saíram de uso — são da pessoa
 *   analises/                    as imagens enviadas à análise
 *   complementos/<slug>.md       o texto publicado de cada complemento
 *   indice.csv                   uma linha por arquivo, com o que se sabe dele
 *   links-de-entrega.csv         nome, destinatário e datas (sem o endereço)
 *   LEIA-ME.txt
 *
 * Aqui só se decide nome, pasta e texto: puro, com teste. Buscar e compactar
 * é `exportar-no-navegador.ts`.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type ArquivoDoManifesto = {
  chave: string;
  tipo: "manual" | "material" | "analise";
  nome: string;
  bytes: number | null;
  detalhes: Record<string, unknown>;
};

export type MarcaDoManifesto = {
  id: string;
  nome: string;
  chave: string;
  arquivos: ArquivoDoManifesto[];
  complementos: { slug: string; titulo: string; versao: number; texto: string; publicado_em: string | null }[];
  links: { nome: string; destinatario: string | null; criado_em: string; expira_em: string; revogado_em: string | null }[];
};

export type Manifesto = {
  id: string;
  iniciada_em: string;
  arquivos: number;
  bytes: number;
  conta: string;
  marcas: MarcaDoManifesto[];
};

export type EntradaDoZip =
  | { tipo: "arquivo"; chave: string; caminho: string }
  | { tipo: "texto"; caminho: string; texto: string };

/** Quantos arquivos pedir de cada vez à rota que assina os endereços. */
export const LOTE_DE_ENDERECOS = 20;

/** Nome que qualquer sistema aceita: sem barra, dois-pontos, controle; até 120. */
export function nomeSeguro(nome: string, padrao = "arquivo"): string {
  const limpo = nome
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!limpo) return padrao;
  if (limpo.length <= 120) return limpo;
  const ponto = limpo.lastIndexOf(".");
  const ext = ponto > 0 && limpo.length - ponto <= 10 ? limpo.slice(ponto) : "";
  return limpo.slice(0, 120 - ext.length).trimEnd() + ext;
}

/** Dois arquivos com o mesmo nome na mesma pasta: o segundo ganha " (2)". */
function semColisao(caminho: string, usados: Set<string>): string {
  let candidato = caminho;
  for (let n = 2; usados.has(candidato.toLowerCase()); n += 1) {
    const barra = caminho.lastIndexOf("/");
    const ponto = caminho.lastIndexOf(".");
    candidato = ponto > barra + 1
      ? `${caminho.slice(0, ponto)} (${n})${caminho.slice(ponto)}`
      : `${caminho} (${n})`;
  }
  usados.add(candidato.toLowerCase());
  return candidato;
}

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function pastaDo(arquivo: ArquivoDoManifesto): string {
  const d = arquivo.detalhes;
  if (arquivo.tipo === "manual") return d.situacao === "substituida" ? "manuais/substituidos" : "manuais";
  if (arquivo.tipo === "analise") return "analises";
  const item = nomeSeguro(texto(d.item), "sem item");
  return d.descontinuado_em ? `materiais/descontinuados/${item}` : `materiais/${item}`;
}

/**
 * O manual vem do banco como "<título> (v<n>)", e o título muitas vezes é o
 * nome do arquivo enviado, com ".pdf" — o que dava "Manual.pdf (v1).pdf". O
 * ".pdf" do meio sai, e o do fim fica uma vez só.
 */
function nomeDoArquivo(arquivo: ArquivoDoManifesto): string {
  if (arquivo.tipo !== "manual") return nomeSeguro(arquivo.nome);
  const nome = nomeSeguro(arquivo.nome.replace(/\.pdf(?=\s*\(v\d+\)\s*$)/i, "").replace(/\.pdf\s*$/i, ""));
  return `${nome}.pdf`;
}

/**
 * Uma célula de CSV: aspas dobradas, e entre aspas sempre. Texto que começa
 * como fórmula (`=`, `+`, `-`, `@`, tab, CR) ganha um apóstrofo na frente: nome
 * de arquivo e pergunta de análise são escritos por outras pessoas, e o Excel
 * executaria a fórmula no computador de quem abre o índice.
 */
function celula(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  const seguro = typeof v === "string" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${seguro.replace(/"/g, '""')}"`;
}

/**
 * CSV com ponto e vírgula e BOM: é o que o Excel em português abre direto,
 * com acento certo e cada campo na sua coluna.
 */
export function csv(linhas: readonly (readonly unknown[])[]): string {
  return "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n";
}

function dia(iso: string): string {
  return iso.slice(0, 10);
}

export function nomeDoZip(marca: Pick<MarcaDoManifesto, "chave">, iniciadaEm: string): string {
  return `brennimark-${nomeSeguro(marca.chave, "marca")}-${dia(iniciadaEm)}.zip`;
}

/** As entradas do ZIP de uma marca, na ordem em que entram. */
export function pacoteDaMarca(marca: MarcaDoManifesto, conta: string, iniciadaEm: string): EntradaDoZip[] {
  const usados = new Set<string>();
  const entradas: EntradaDoZip[] = [];
  const indice: unknown[][] = [[
    "arquivo", "tipo", "item", "status", "situação", "descontinuado em", "eixos", "páginas", "bytes", "enviado em", "pergunta", "veredito",
  ]];

  for (const arquivo of marca.arquivos) {
    const caminho = semColisao(`${pastaDo(arquivo)}/${nomeDoArquivo(arquivo)}`, usados);
    entradas.push({ tipo: "arquivo", chave: arquivo.chave, caminho });
    const d = arquivo.detalhes;
    const eixos = ["hierarquia", "lockup", "cor", "polaridade", "espaco_de_cor"].map((k) => texto(d[k])).filter(Boolean).join(", ");
    indice.push([
      caminho,
      { manual: "manual", material: "material", analise: "análise" }[arquivo.tipo],
      texto(d.item), texto(d.status), texto(d.situacao), texto(d.descontinuado_em), eixos,
      d.paginas ?? "", arquivo.bytes ?? "", texto(d.enviado_em), texto(d.pergunta), texto(d.veredito),
    ]);
  }

  for (const c of marca.complementos) {
    const caminho = semColisao(`complementos/${nomeSeguro(c.slug, "complemento")}.md`, usados);
    entradas.push({ tipo: "texto", caminho, texto: `# ${c.titulo}\n\n${c.texto}\n` });
    indice.push([caminho, "complemento", "", "", `versão ${c.versao}`, "", "", "", "", c.publicado_em ?? "", "", ""]);
  }

  entradas.push({ tipo: "texto", caminho: "indice.csv", texto: csv(indice) });
  if (marca.links.length > 0) {
    entradas.push({
      tipo: "texto",
      caminho: "links-de-entrega.csv",
      texto: csv([
        ["nome", "destinatário", "criado em", "expira em", "revogado em"],
        ...marca.links.map((l) => [l.nome, l.destinatario ?? "", l.criado_em, l.expira_em, l.revogado_em ?? ""]),
      ]),
    });
  }
  entradas.push({
    tipo: "texto",
    caminho: "LEIA-ME.txt",
    texto: [
      `Exportação do Brennimark`,
      ``,
      `Conta: ${conta}`,
      `Marca: ${marca.nome}`,
      `Exportada em: ${iniciadaEm}`,
      ``,
      `manuais/       os manuais em PDF, como foram enviados (substituidos/: versões anteriores)`,
      `materiais/     os arquivos originais da biblioteca, por item (descontinuados/: os que saíram de uso)`,
      `analises/      as imagens enviadas para análise`,
      `complementos/  o texto publicado de cada complemento`,
      `indice.csv     uma linha por arquivo, com tipo, status e datas`,
      marca.links.length > 0 ? `links-de-entrega.csv  os links criados (o endereço não vem: ele funcionava como senha)` : "",
      ``,
      `Miniaturas e imagens de página não vêm: o sistema as gera a partir dos originais.`,
      ``,
    ].filter((l, i, todas) => l !== "" || todas[i - 1] !== "").join("\n"),
  });
  return entradas;
}

/** O aviso que vai dentro do ZIP quando algum arquivo não veio. */
export function textoDosQueFaltaram(caminhos: readonly string[]): string {
  return [
    `Estes ${caminhos.length} arquivo(s) não puderam ser baixados nesta exportação.`,
    `Tente exportar de novo; se continuar, peça a exportação pela tela do Plano.`,
    ``,
    ...caminhos,
    ``,
  ].join("\n");
}
