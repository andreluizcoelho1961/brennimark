import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A autorização de ENVIO de um material — o arquivo vai do navegador direto ao
 * Storage (24/09/2026).
 *
 * Até aqui o arquivo atravessava a função da Vercel, cujo corpo é cortado em
 * ~4,5 MB, e o produto prometia 25 MB: um EPS grande falhava em produção. Agora
 * são dois passos, e o arquivo não passa pela função em nenhum:
 *
 *   PREPARAR   a rota confere item, eixos, tipo e tamanho declarados, escolhe o
 *              caminho (nunca o cliente) e devolve um endereço de envio que só
 *              serve PARA ESSE CAMINHO, mais esta autorização assinada;
 *   CONCLUIR   o navegador devolve a autorização; a rota confere assinatura,
 *              prazo, pessoa e marca, lê os primeiros bytes e o tamanho REAIS do
 *              que chegou, e só então registra a variante.
 *
 * A autorização carrega tudo o que foi validado no primeiro passo. O segundo
 * não confia em nada que o cliente mande de novo — só nela.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export type DadosDoEnvio = {
  workspaceId: string;
  brandId: string;
  userId: string;
  itemId: string;
  caminho: string;
  label: string;
  description: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  eixos: Record<string, string | null>;
  substitui: string | null;
  /** Até quando vale, em milissegundos desde 1970. */
  expira: number;
};

/** Dez minutos: o bastante para subir 25 MB numa conexão ruim. */
export const PRAZO_DO_ENVIO_MS = 10 * 60 * 1000;

function b64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function assinatura(corpo: string, chave: string): Buffer {
  // A chave de envio é DERIVADA da chave-mestra, com rótulo próprio: um uso
  // novo não reaproveita a chave de outro propósito como está.
  const derivada = createHmac("sha256", chave).update("brennimark:envio-de-material:v1").digest();
  return createHmac("sha256", derivada).update(corpo).digest();
}

export function assinarEnvio(dados: DadosDoEnvio, chave: string): string {
  const corpo = b64url(Buffer.from(JSON.stringify(dados), "utf8"));
  return `${corpo}.${b64url(assinatura(corpo, chave))}`;
}

export type LeituraDoEnvio =
  | { ok: true; dados: DadosDoEnvio }
  | { ok: false; motivo: "formato" | "assinatura" | "expirado" | "outra-pessoa" };

export function lerEnvio(
  token: unknown,
  chave: string,
  quem: { userId: string; workspaceId: string; brandId: string },
  agora = Date.now(),
): LeituraDoEnvio {
  if (typeof token !== "string" || token.length > 8_000) return { ok: false, motivo: "formato" };
  const [corpo, assinado, sobra] = token.split(".");
  if (!corpo || !assinado || sobra !== undefined) return { ok: false, motivo: "formato" };

  const esperada = assinatura(corpo, chave);
  const recebida = Buffer.from(assinado, "base64url");
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return { ok: false, motivo: "assinatura" };

  let dados: DadosDoEnvio;
  try {
    dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as DadosDoEnvio;
  } catch {
    return { ok: false, motivo: "formato" };
  }
  if (typeof dados.expira !== "number" || agora > dados.expira) return { ok: false, motivo: "expirado" };
  // Assinada para OUTRA pessoa ou outra marca: repassar a autorização não
  // transfere o envio.
  if (dados.userId !== quem.userId || dados.workspaceId !== quem.workspaceId || dados.brandId !== quem.brandId) {
    return { ok: false, motivo: "outra-pessoa" };
  }
  return { ok: true, dados };
}

/**
 * O tamanho total dito por um `Content-Range` ("bytes 0-511/12345678").
 * `null` quando o servidor não informa — e aí o envio não se conclui.
 */
export function tamanhoDoContentRange(cabecalho: string | null): number | null {
  const total = cabecalho?.match(/\/(\d+)\s*$/)?.[1];
  return total ? Number(total) : null;
}
