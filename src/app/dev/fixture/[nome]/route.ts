import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { contentRange, contentRangeForaDoAlcance, resolverRange } from "@/lib/documento-fonte/range";

/**
 * As fixtures de PDF, servidas com semântica de `Range` — só em desenvolvimento.
 *
 * Existe por um motivo estreito: a rota real do documento-fonte exige sessão,
 * conta e marca, **corretamente**, e a suíte de navegador roda com autenticação
 * desligada. Sem um endereço alternativo, o visualizador só seria exercitável à
 * mão — que é exatamente como sete defeitos chegaram até a primeira abertura de
 * um manual real.
 *
 * Ela repassa a semântica de intervalo pelo MESMO módulo que a rota de produção
 * usa para conferir, então a suíte também exercita o sufixo `bytes=-N` que o
 * PDF.js pede primeiro.
 *
 * Fora de produção por construção, e o nome do arquivo nunca vira caminho: só
 * um nome da pasta de fixtures é aceito, sem separador e sem `..`.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ nome: string }> },
) {
  if (process.env.NODE_ENV === "production") notFound();

  const { nome } = await params;
  // Sem barra, sem `..`, sem nada que navegue. O nome é um rótulo, não um caminho.
  if (!/^[a-z0-9][a-z0-9._-]{0,80}\.pdf$/i.test(nome) || nome.includes("..")) {
    return new Response(null, { status: 404 });
  }

  const arquivo = path.join(process.cwd(), "e2e/fixtures", nome);
  let tamanho: number;
  try {
    tamanho = (await stat(arquivo)).size;
  } catch {
    return new Response(null, { status: 404 });
  }

  const comuns = {
    "content-type": "application/pdf",
    "accept-ranges": "bytes",
    "cache-control": "no-store",
  };

  const pedido = resolverRange(request.headers.get("range"), tamanho);

  if (pedido.tipo === "fora-do-alcance") {
    return new Response(null, {
      status: 416,
      headers: { ...comuns, "content-range": contentRangeForaDoAlcance(tamanho) },
    });
  }

  const bytes = await readFile(arquivo);

  if (pedido.tipo === "parcial") {
    const fatia = bytes.subarray(pedido.inicio, pedido.fim + 1);
    return new Response(new Uint8Array(fatia), {
      status: 206,
      headers: {
        ...comuns,
        "content-range": contentRange(pedido.inicio, pedido.fim, tamanho),
        "content-length": String(fatia.byteLength),
      },
    });
  }

  // Sem intervalo (ou intervalo que a especificação manda ignorar): arquivo
  // inteiro, com os cabeçalhos que fazem o PDF.js decidir pedir intervalos.
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { ...comuns, "content-length": String(tamanho) },
  });
}
