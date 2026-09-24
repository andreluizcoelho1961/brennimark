"use client";

import { zip, type Zippable } from "fflate";

/**
 * Monta o ZIP do kit NO NAVEGADOR — fatia 5 (spec de Materiais §9).
 *
 * A rota do kit já registrou cada arquivo e devolveu endereços assinados de
 * curta duração; aqui eles são buscados (quatro por vez) e compactados. Nada
 * passa pela função da Vercel: o teto de 4 MiB por resposta derrubaria
 * qualquer kit de verdade, e uma segunda cópia do kit no Storage envelheceria.
 *
 * Falha de UM arquivo derruba o kit inteiro, com a mensagem dizendo qual: um
 * ZIP com buraco pareceria completo ao designer.
 */
const EM_PARALELO = 4;

export class FalhaDoKit extends Error {
  constructor(readonly caminho: string) {
    super(`não foi possível buscar ${caminho}`);
    this.name = "FalhaDoKit";
  }
}

export async function montarZip(
  arquivos: readonly { url: string; caminho: string }[],
  aoAvancar?: (prontos: number, total: number) => void,
  sinal?: AbortSignal,
): Promise<Blob> {
  const conteudo: Zippable = {};
  let proximo = 0;
  let prontos = 0;

  async function trabalhador() {
    while (proximo < arquivos.length) {
      const arquivo = arquivos[proximo++];
      const resposta = await fetch(arquivo.url, { signal: sinal, cache: "no-store" }).catch(() => null);
      if (!resposta?.ok) throw new FalhaDoKit(arquivo.caminho);
      // Nível 0 (só guardar) para o que já vem compactado — PNG, JPG, ZIP,
      // PDF: recompactar gasta tempo e não ganha nada. Vetor e texto, 6.
      const jaCompactado = /\.(png|jpe?g|webp|zip|pdf|woff2?)$/i.test(arquivo.caminho);
      conteudo[arquivo.caminho] = [new Uint8Array(await resposta.arrayBuffer()), { level: jaCompactado ? 0 : 6 }];
      prontos += 1;
      aoAvancar?.(prontos, arquivos.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(EM_PARALELO, arquivos.length) }, trabalhador));

  const bytes = await new Promise<Uint8Array>((resolver, rejeitar) =>
    zip(conteudo, (erro, dados) => (erro ? rejeitar(erro) : resolver(dados))),
  );
  return new Blob([bytes as BlobPart], { type: "application/zip" });
}

/** Entrega um Blob como download, com o nome dado. */
export function salvarArquivo(blob: Blob, nome: string) {
  const endereco = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = endereco;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Dá tempo ao navegador de começar a gravar antes de soltar a memória.
  setTimeout(() => URL.revokeObjectURL(endereco), 30_000);
}
