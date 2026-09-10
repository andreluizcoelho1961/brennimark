import { createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/storage/caminhos";
import {
  servirDocumentoFonte,
  type LinhaDoDocumento,
  type PortasDoDocumento,
} from "@/lib/documento-fonte/servir";

/**
 * O transporte do documento-fonte: o PDF do manual, por intervalos.
 *
 * A lógica vive em `@/lib/documento-fonte/servir` com as dependências
 * injetadas — um módulo de rota do App Router só exporta verbos HTTP, e nada
 * dentro dele é alcançável por teste. Aqui ficam apenas as portas reais.
 *
 * POR QUE ESTA ROTA EXISTE, e não uma URL assinada direta: a URL direta foi
 * medida no navegador e não entrega carregamento progressivo — o Storage do
 * Supabase não expõe `accept-ranges` nem `content-range` por CORS, o PDF.js
 * conclui que não há suporte a intervalo e baixa o arquivo INTEIRO.
 *
 * O QUE ELA NÃO PROMETE: nada aqui impede quem pode ver o documento inteiro de
 * obter os bytes. A rota melhora autorização, auditoria e a separação entre
 * ver e baixar — não cria uma garantia que não existe.
 */
async function portasReais(): Promise<PortasDoDocumento> {
  const supabase = await createClient();

  return {
    async documento(id, marcaChave) {
      /**
       * Uma consulta, autorizada pela RLS.
       *
       * `brand_imports` só devolve linha de workspace do qual a pessoa é
       * membro — se a linha vem, a autorização está provada pelo banco, que é
       * a fronteira de segurança real e não a interface. A marca é conferida
       * pelo `inner join`, no mesmo ida-e-volta.
       *
       * Medido: a autorização de contexto completo custava ~350 ms por pedido
       * de intervalo; esta custa 16 ms.
       */
      const { data, error } = await supabase
        .from("brand_imports")
        .select("import_id, storage_path, pdf_sha256, workspace_id, brands!inner(key)")
        .eq("id", id)
        .eq("brands.key", marcaChave)
        .maybeSingle();
      return { linha: (data as LinhaDoDocumento | null) ?? null, error };
    },

    async token() {
      // `getSession` lê o que o cliente do servidor já resolveu dos cookies —
      // não é uma ida à Auth API.
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token;
    },

    endereco(caminho) {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
      // Cada segmento codificado: nome de arquivo não escapa do caminho.
      const partes = caminho.split("/").map(encodeURIComponent).join("/");
      return `${base}/storage/v1/object/authenticated/${BUCKETS.importacoes}/${partes}`;
    },

    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,

    buscar: (url, init) => fetch(url, init),
  };
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return servirDocumentoFonte(request, { id, metodo: "GET" }, await portasReais());
}

/**
 * HEAD responde o mesmo, sem corpo.
 *
 * Não é adorno: é como o visualizador descobre o tamanho sem puxar byte
 * nenhum, e é o que evita a requisição sem `Range` que mata a função em
 * produção. O Next não deriva HEAD de GET para rotas de rota.
 */
export async function HEAD(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return servirDocumentoFonte(request, { id, metodo: "HEAD" }, await portasReais());
}
