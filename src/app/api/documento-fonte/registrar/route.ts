import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  registrarDocumentoFonte,
  type PedidoDeRegistro,
  type PortasDoRegistro,
  type RegistroDeImportacao,
} from "@/lib/documento-fonte/registrar";
import { lerSecoesDaMarca, type PaginaDeSecoes } from "@/lib/documento-fonte/secoes-da-marca";

/**
 * O segundo passo da publicação, no servidor.
 *
 * A lógica vive em `@/lib/documento-fonte/registrar` com dependências
 * injetadas — módulo de rota do App Router só exporta verbos HTTP, e nada
 * dentro dele é alcançável por teste. Aqui ficam apenas as portas reais.
 *
 * ─── Dois clientes, e a fronteira entre eles ────────────────────────────
 *
 *   sessão            resolve usuário, conta, marca, importação e seções, SOB
 *                     RLS. É ela que garante que a seção pertence à marca de
 *                     quem pede, e que a importação pertence à conta.
 *   chave de serviço  chama a RPC `service_role`-only, que é a única capaz de
 *                     gravar manifesto completo — e de fechar o vínculo, que
 *                     `authenticated` não pode escrever.
 *
 * A chave de serviço **nunca** resolve nada do domínio: ela não tem `select`
 * em `brand_documents`, de propósito. Trocar isso por conveniência ampliaria a
 * superfície da chave mais poderosa do sistema.
 *
 * ─── Toda porta devolve `{ dados, erro }`, e isso não é cerimônia ───────
 *
 * "A consulta rodou e não há linha" e "a consulta não rodou" precisam chegar
 * separadas ao módulo: a primeira é 404 permanente, a segunda é 503 repetível.
 * Colapsar as duas produzia o pior defeito desta rota — uma queda de banco na
 * resolução de seções gravava mil páginas como `sem-secao`, o vínculo fechava,
 * e a idempotência impedia qualquer repetição de corrigir.
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
      const { data, error } = await sessao.auth.getUser();
      return { dados: data?.user ? { id: data.user.id } : null, erro: error };
    },

    async conta(slug) {
      // `workspaces.slug` tem índice único global, então o slug sozinho
      // resolve uma conta só. A RLS decide se esta pessoa a alcança.
      const { data, error } = await sessao
        .from("workspaces")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      return { dados: data ?? null, erro: error };
    },

    async marca(contaId, chave) {
      /*
       * O PAR, e não a chave sozinha. `brands` garante
       * `unique (workspace_id, key)` — a chave é única dentro da conta, não
       * globalmente. Quem participa de duas contas com uma marca `padaria` em
       * cada faria `maybeSingle` receber duas linhas e recusar, e a rota
       * responderia 404 para uma marca que existe.
       */
      const { data, error } = await sessao
        .from("brands")
        .select("id")
        .eq("workspace_id", contaId)
        .eq("key", chave)
        .maybeSingle();
      return { dados: data ?? null, erro: error };
    },

    async importacao(importId, brandId, workspaceId) {
      // Os três filtros, sempre. A FK composta já garantiria o vínculo, mas
      // deixar conta ou marca de fora faria esta consulta depender de uma
      // garantia que vive em outro arquivo.
      const { data, error } = await sessao
        .from("brand_imports")
        .select("import_id, storage_path, pdf_sha256, page_count, source_document_id, report")
        .eq("import_id", importId)
        .eq("brand_id", brandId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      return { dados: (data as RegistroDeImportacao | null) ?? null, erro: error };
    },

    async secoes(brandId) {
      /*
       * As seções da marca por PÁGINAS, e não os slugs num `.in(...)`.
       *
       * O `.in` mandava até 500 slugs de 60 caracteres na query string, e o
       * teto de linha de requisição varia por proxy. A falha era segura desde
       * a correção da leitura — virava 503 —, mas PERMANENTE: repetir monta a
       * mesma URL e falha igual, e o manual grande ficaria impossível de
       * registrar sob uma mensagem que diz "tente de novo".
       *
       * Buscar tudo numa ida trocaria isso por uma truncagem silenciosa em
       * `max_rows`. A regra da paginação vive em `secoes-da-marca.ts`, com
       * teste; aqui fica só a consulta.
       */
      return lerSecoesDaMarca(async (de, ate) => {
        const { data, error } = await sessao
          .from("brand_documents")
          .select("id, slug")
          .eq("brand_id", brandId)
          // Ordem estável entre as idas: sem ela, uma página pode repetir
          // linhas e outra pode nunca aparecer.
          .order("id", { ascending: true })
          .range(de, ate);
        if (error) return { dados: null, erro: error };
        return { dados: (data ?? []) as PaginaDeSecoes[], erro: null };
      });
    },

    async registrar(argumentos) {
      const servico = createServiceClient();
      const { data, error } = await servico.rpc("registrar_documento_fonte", argumentos);
      return { id: (data as string | null) ?? null, erro: error };
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
