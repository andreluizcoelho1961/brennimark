"use client";

import { strToU8, zip, type Zippable } from "fflate";
import { LOTE_DE_ENDERECOS, textoDosQueFaltaram, type EntradaDoZip } from "./pacote-da-exportacao";

/**
 * Monta o ZIP de uma marca NO NAVEGADOR (08/10/2026). Mesma razão do kit
 * (`lib/assets/zip-no-navegador.ts`): nada passa pela função da Vercel.
 *
 * Diferença do kit: aqui o acervo pode ter centenas de arquivos, então os
 * endereços assinados são pedidos em LOTES, logo antes de cada busca — um
 * endereço de dois minutos emitido no começo venceria no meio de um acervo
 * grande. E um arquivo que não vem não derruba a marca inteira: ganha uma
 * segunda tentativa e, se ainda faltar, entra na lista `FALTARAM.txt` dentro
 * do ZIP e na tela. Um ZIP com buraco sem aviso pareceria completo; com o
 * aviso, a pessoa sabe o que tentar de novo.
 */
const EM_PARALELO = 4;

export type ResultadoDaMarca = { blob: Blob; faltaram: string[] };

export async function montarZipDaMarca(
  entradas: readonly EntradaDoZip[],
  pedirEnderecos: (chaves: string[]) => Promise<Record<string, string>>,
  aoAvancar?: (prontos: number, total: number) => void,
  sinal?: AbortSignal,
): Promise<ResultadoDaMarca> {
  const conteudo: Zippable = {};
  const faltaram: string[] = [];
  const arquivos = entradas.filter((e): e is Extract<EntradaDoZip, { tipo: "arquivo" }> => e.tipo === "arquivo");
  let prontos = 0;

  for (let inicio = 0; inicio < arquivos.length; inicio += LOTE_DE_ENDERECOS) {
    sinal?.throwIfAborted();
    const lote = arquivos.slice(inicio, inicio + LOTE_DE_ENDERECOS);
    const enderecos = await pedirEnderecos(lote.map((a) => a.chave));
    let proximo = 0;

    async function trabalhador() {
      while (proximo < lote.length) {
        const arquivo = lote[proximo++];
        const url = enderecos[arquivo.chave];
        const bytes = url ? await buscar(url, sinal) : null;
        if (bytes) {
          const jaCompactado = /\.(png|jpe?g|webp|gif|zip|pdf|woff2?|mp4|mov)$/i.test(arquivo.caminho);
          conteudo[arquivo.caminho] = [bytes, { level: jaCompactado ? 0 : 6 }];
        } else {
          faltaram.push(arquivo.caminho);
        }
        prontos += 1;
        aoAvancar?.(prontos, arquivos.length);
      }
    }
    await Promise.all(Array.from({ length: Math.min(EM_PARALELO, lote.length) }, trabalhador));
  }

  for (const e of entradas) if (e.tipo === "texto") conteudo[e.caminho] = [strToU8(e.texto), { level: 6 }];
  if (faltaram.length > 0) conteudo["FALTARAM.txt"] = [strToU8(textoDosQueFaltaram(faltaram)), { level: 6 }];

  const bytes = await new Promise<Uint8Array>((resolver, rejeitar) =>
    zip(conteudo, (erro, dados) => (erro ? rejeitar(erro) : resolver(dados))),
  );
  return { blob: new Blob([bytes as BlobPart], { type: "application/zip" }), faltaram };
}

/** Duas tentativas; `null` se o arquivo não veio. Cancelar não é falha. */
async function buscar(url: string, sinal?: AbortSignal): Promise<Uint8Array | null> {
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    sinal?.throwIfAborted();
    const resposta = await fetch(url, { signal: sinal, cache: "no-store" }).catch((erro) => {
      if (sinal?.aborted) throw erro;
      return null;
    });
    if (resposta?.ok) return new Uint8Array(await resposta.arrayBuffer());
  }
  return null;
}
