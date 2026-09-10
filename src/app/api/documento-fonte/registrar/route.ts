import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  registrarDocumentoFonte,
  type PedidoDeRegistro,
  type PortasDoRegistro,
  type RegistroDeImportacao,
} from "@/lib/documento-fonte/registrar";

/**
 * O segundo passo da publicação, no servidor.
 *
 * A lógica vive em `@/lib/documento-fonte/registrar` com dependências
 * injetadas — módulo de rota do App Router só exporta verbos HTTP, e nada
 * dentro dele é alcançável por teste. Aqui ficam apenas as portas reais.
 *
 * ─── Dois clientes, e a fronteira entre eles ────────────────────────────
 *
 *   sessão            resolve usuário, marca, importação e seções, SOB RLS. É
 *                     ela que garante que a seção pertence à marca de quem
 *                     pede, e que a importação pertence à conta.
 *   chave de serviço  chama a RPC `service_role`-only, que é a única capaz de
 *                     gravar manifesto completo sem dar `insert` ao cliente.
 *
 * A chave de serviço **nunca** resolve nada do domínio: ela não tem `select`
 * em `brand_documents`, de propósito. Trocar isso por conveniência ampliaria a
 * superfície da chave mais poderosa do sistema.
 */
export async function POST(request: Request) {
  let pedido: PedidoDeRegistro;
  try {
    pedido = (await request.json()) as PedidoDeRegistro;
  } catch {
    return NextResponse.json({ codigo: "pedido_invalido", repetivel: false }, { status: 400 });
  }

  const sessao = await createClient();

  const portas: PortasDoRegistro = {
    async ator() {
      /*
       * `getUser` e não `getSession`: aqui o token precisa ser VALIDADO, não
       * apenas lido dos cookies. Este é o ponto em que o servidor decide quem
       * é o ator de uma escrita — é o lugar onde a ida à Auth API se paga.
       */
      const { data } = await sessao.auth.getUser();
      return data.user ? { id: data.user.id } : null;
    },

    async marca(chave) {
      const { data } = await sessao
        .from("brands")
        .select("id, workspace_id")
        .eq("key", chave)
        .maybeSingle();
      return data ?? null;
    },

    async importacao(importId, brandId, workspaceId) {
      // Os três filtros, sempre. A FK composta já garantiria o vínculo, mas
      // deixar conta ou marca de fora faria esta consulta depender de uma
      // garantia que vive em outro arquivo.
      const { data } = await sessao
        .from("brand_imports")
        .select("id, storage_path, pdf_sha256, page_count, source_document_id, report")
        .eq("import_id", importId)
        .eq("brand_id", brandId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      return (data as RegistroDeImportacao | null) ?? null;
    },

    async secoes(brandId, slugs) {
      const { data } = await sessao
        .from("brand_documents")
        .select("id, slug")
        .eq("brand_id", brandId)
        .in("slug", slugs);
      return new Map((data ?? []).map((s) => [s.slug as string, s.id as string]));
    },

    async registrar(argumentos) {
      const servico = createServiceClient();
      const { data, error } = await servico.rpc("registrar_documento_fonte", argumentos);
      return { id: (data as string | null) ?? null, erro: error };
    },

    async vincular(id, sourceDocumentId) {
      // Sob a sessão, com RLS: só quem pode escrever na conta fecha o vínculo.
      const { error } = await sessao
        .from("brand_imports")
        .update({ source_document_id: sourceDocumentId })
        .eq("id", id);
      return { erro: error };
    },
  };

  const resultado = await registrarDocumentoFonte(pedido, portas);

  if (!resultado.ok) {
    /*
     * O detalhe técnico fica no LOG, e o navegador recebe só o código.
     *
     * Mensagem de banco na tela vaza a forma interna do esquema, chega numa
     * só língua e muda quando alguém reescreve um `raise`. O código é o
     * contrato; o texto é decisão da interface.
     */
    if (resultado.tecnico) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "registro_do_documento_fonte_falhou",
          codigo: resultado.codigo,
          detalhe: resultado.tecnico,
        }),
      );
    }
    return NextResponse.json(
      { codigo: resultado.codigo, repetivel: resultado.repetivel },
      { status: resultado.status },
    );
  }

  return NextResponse.json({
    documentoId: resultado.documentoId,
    paginas: resultado.paginas,
    paginasSemSecao: resultado.paginasSemSecao,
    jaEstava: resultado.jaEstava,
  });
}
