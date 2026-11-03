/**
 * O pedido de registro do download da paleta (03/11/2026): só o formato e
 * quantas cores. É lista fechada e número, e o banco confere de novo
 * (`downloads_de_paleta_formato_check`, `downloads_de_paleta_cores_check`).
 */
export const FORMATOS_DA_PALETA = ["ase", "css", "json", "png"] as const;
export type FormatoDaPaleta = (typeof FORMATOS_DA_PALETA)[number];

export function lerPedidoDeDownloadDaPaleta(corpo: unknown): { formato: FormatoDaPaleta; cores: number } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const { formato, cores } = corpo as { formato?: unknown; cores?: unknown };
  if (typeof formato !== "string" || !(FORMATOS_DA_PALETA as readonly string[]).includes(formato)) return null;
  if (typeof cores !== "number" || !Number.isInteger(cores) || cores < 1 || cores > 200) return null;
  return { formato: formato as FormatoDaPaleta, cores };
}

/** O nome do arquivo que o Registros mostra: o mesmo que a ferramenta gera. */
export function arquivoDaPaleta(marca: string, formato: string): string {
  const slug = marca.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `paleta-${slug}.${formato}`;
}
