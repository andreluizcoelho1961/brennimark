import type { SupabaseClient } from "@supabase/supabase-js";

import type { ObjetoProvisorio, PortasDeEnvio } from "./orfaos";

/**
 * O adaptador entre `orfaos.ts` e o Supabase de verdade.
 *
 * Fica separado porque é a única parte que não dá para testar sem rede: a
 * decisão — o que fazer quando o PDF falha depois de as imagens subirem — vive
 * em `orfaos.ts`, coberta por teste; aqui só há tradução de chamadas.
 */
export function portasDeEnvioSupabase(
  supabase: SupabaseClient,
  workspaceId: string,
): PortasDeEnvio {
  return {
    async enviarImagem(caminho, dados) {
      const { error } = await supabase.storage
        .from("brand-assets")
        .upload(caminho, dados as Blob, { contentType: "image/png", upsert: false });
      return error ? { erro: error.message } : {};
    },

    async enviarPdf(caminho, dados) {
      /**
       * `upsert: false` de propósito: o objeto é IMUTÁVEL e o caminho é a
       * impressão digital do arquivo. Mesmo hash significa mesmo arquivo, byte
       * a byte — um 409 aqui é reencontro, não erro, e tratá-lo como falha
       * apagaria as imagens de uma importação que vai seguir normalmente.
       */
      const { error } = await supabase.storage
        .from("brand-imports")
        .upload(caminho, dados as File, { contentType: "application/pdf", upsert: false });
      if (!error) return {};
      const jaExiste = "statusCode" in error && String(error.statusCode) === "409";
      return { erro: error.message, jaExiste };
    },

    async remover(bucket, caminhos) {
      const { error } = await supabase.storage.from(bucket).remove(caminhos);
      return error ? { erro: error.message } : {};
    },

    async ausente(bucket, caminho) {
      const corte = caminho.lastIndexOf("/");
      const pasta = caminho.slice(0, corte);
      const nome = caminho.slice(corte + 1);
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(pasta, { search: nome, limit: 1 });
      // Erro ao listar não é ausência — mesma disciplina de
      // `drenarFilaDeExclusao`: manter como pendente é o lado seguro do engano.
      if (error) return false;
      return !(data ?? []).some((objeto) => objeto.name === nome);
    },

    async enfileirar(itens: ObjetoProvisorio[]) {
      /**
       * A política `Owners enqueue their own deletions` exige `requested_by =
       * auth.uid()`, então o id do usuário é obrigatório — e é buscado só
       * aqui, no caminho de falha, para não cobrar uma ida à rede de toda
       * importação que dá certo.
       */
      const { data: sessao, error: erroDeSessao } = await supabase.auth.getUser();
      const userId = sessao?.user?.id;
      if (erroDeSessao || !userId) {
        return { erro: erroDeSessao?.message ?? "sem sessão para registrar a pendência" };
      }
      const { error } = await supabase.from("brand_deletions").insert(
        itens.map((item) => ({
          workspace_id: workspaceId,
          bucket_id: item.bucket,
          storage_path: item.caminho,
          requested_by: userId,
        })),
      );
      return error ? { erro: error.message } : {};
    },
  };
}
