/**
 * O kit de um item de Materiais — fatia 5 (spec de Materiais §5-A, André 17/09).
 *
 * "O designer precisa de tudo": cada item baixa o kit inteiro num ZIP, e o ZIP
 * se organiza pelos EIXOS da variante — é isso que o designer encontra ao
 * descompactar, em vez de uma pasta de nomes soltos:
 *
 *   sony-vaio-logotipo/
 *   ├── principal/horizontal/colorido-positivo-rgb/logo.svg
 *   └── principal/vertical/mono-negativo-cmyk/logo.eps
 *
 * O nome do arquivo é o que o assinante enviou — a plataforma distribui o
 * original, e não inventa nome. Colisão na mesma pasta ganha sufixo.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import type { Eixos } from "./eixos";

export type VarianteDoKit = { id: string; fileName: string; eixos: Eixos };

/** Nome de pasta ou arquivo seguro: sem barra, sem controle, sem ponto inicial. */
export function segmentoSeguro(bruto: string, reserva: string): string {
  const limpo = bruto
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[\u0000-\u001f\u007f"<>:|?*\\/]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .trim()
    .toLowerCase()
    .slice(0, 80);
  return limpo || reserva;
}

/** O nome do ZIP: `marca-item.zip`. */
export function nomeDoKit(marca: string, item: string): string {
  return `${segmentoSeguro(marca, "marca")}-${segmentoSeguro(item, "materiais")}.zip`;
}

/**
 * A pasta de uma variante: hierarquia / lockup / cor-polaridade-espaço.
 * Eixo que não se aplica ao tipo (nulo) simplesmente não vira pasta.
 */
export function pastaDaVariante(eixos: Eixos): string[] {
  const pastas: string[] = [];
  if (eixos.hierarquia) pastas.push(eixos.hierarquia);
  if (eixos.lockup) pastas.push(eixos.lockup);
  const acabamento = [eixos.cor, eixos.polaridade, eixos.espaco_de_cor].filter(Boolean).join("-");
  if (acabamento) pastas.push(acabamento);
  return pastas;
}

/** O caminho de cada variante dentro do ZIP, sem colisão. */
export function caminhosNoKit(raiz: string, variantes: readonly VarianteDoKit[]): Map<string, string> {
  const usados = new Set<string>();
  const caminhos = new Map<string, string>();
  const base = segmentoSeguro(raiz.replace(/\.zip$/i, ""), "materiais");
  for (const v of variantes) {
    const pasta = [base, ...pastaDaVariante(v.eixos)].join("/");
    const nome = segmentoSeguro(v.fileName, "arquivo");
    const ponto = nome.lastIndexOf(".");
    const [corpo, extensao] = ponto > 0 ? [nome.slice(0, ponto), nome.slice(ponto)] : [nome, ""];
    let caminho = `${pasta}/${nome}`;
    for (let n = 2; usados.has(caminho); n += 1) caminho = `${pasta}/${corpo}-${n}${extensao}`;
    usados.add(caminho);
    caminhos.set(v.id, caminho);
  }
  return caminhos;
}

/** Até quantos arquivos um kit leva — um pedido, uma rota, uma leva de links. */
export const MAXIMO_DO_KIT = 60;
