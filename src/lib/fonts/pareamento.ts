import { createHash } from "node:crypto";

const hex64 = /^[0-9a-f]{64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PedidoDePareamento = { id: string; tokenHash: string; segredoHash: string; rotuloDoDispositivo: string };

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function validarPedidoDePareamento(value: unknown): PedidoDePareamento | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id : "";
  const tokenHash = typeof candidate.tokenHash === "string" ? candidate.tokenHash : "";
  const segredoHash = typeof candidate.segredoHash === "string" ? candidate.segredoHash : "";
  const rotuloDoDispositivo = typeof candidate.rotuloDoDispositivo === "string" ? candidate.rotuloDoDispositivo.trim() : "";
  if (!uuid.test(id) || !hex64.test(tokenHash) || !hex64.test(segredoHash) || rotuloDoDispositivo.length < 1 || rotuloDoDispositivo.length > 80 || /[\x00-\x1f\x7f]/.test(rotuloDoDispositivo)) return null;
  return { id, tokenHash, segredoHash, rotuloDoDispositivo };
}

export function validarIdDePareamento(value: unknown): string | null {
  return typeof value === "string" && uuid.test(value) ? value : null;
}

export function lerTokenDoDispositivo(request: Request): string | null {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token.length >= 32 && token.length <= 512 ? token : null;
}
