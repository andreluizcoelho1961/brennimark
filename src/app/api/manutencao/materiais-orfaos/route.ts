import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { LOTE, drenarFilaDeExclusao } from "@/lib/import/limpeza";
import { BUCKETS } from "@/lib/storage/caminhos";
import { limparMateriaisOrfaos, segredoDoCronConfere } from "@/lib/assets/limpeza-de-orfaos";

/**
 * A limpeza periódica do material órfão — chamada pelo Vercel Cron, uma vez
 * por dia (`vercel.json`). A decisão vive em `@/lib/assets/limpeza-de-orfaos`;
 * aqui só as portas reais.
 *
 * ─── Quem chama ─────────────────────────────────────────────────────────
 *
 * Ninguém com sessão. O Vercel Cron manda `Authorization: Bearer
 * ${CRON_SECRET}`; sem ele, ou com o segredo não configurado, 401 antes de
 * qualquer cliente existir. O `proxy` deixa `/api/manutencao/` passar sem
 * sessão (`caminhos-publicos.ts`) — a trava é ESTA, e só esta.
 *
 * ─── A chave de serviço, e o que a segura ───────────────────────────────
 *
 *   enfileirar   a função `service_role`-only decide o que é órfão, no banco;
 *   drenar       conta por conta, com escopo: só o bucket de Materiais, só
 *                caminho dentro da pasta da conta, nunca o de uma variante
 *                registrada. Sem sessão, as policies do Storage não seguram
 *                nada — o escopo é a trava.
 *
 * O resto da fila (PDF de importação, evidência) continua sendo drenado pela
 * sessão de quem administra, como antes.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!segredoDoCronConfere(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  let servico;
  try {
    servico = createServiceClient();
  } catch {
    return NextResponse.json({ message: "A chave de serviço não está configurada." }, { status: 503 });
  }

  const resumo = await limparMateriaisOrfaos({
    async enfileirar(limite) {
      const { data, error } = await servico.rpc("enfileirar_materiais_orfaos", { p_limite: limite });
      return { dados: typeof data === "number" ? data : null, erro: error };
    },
    async contasComPendencia() {
      // Mais antigas primeiro: quem espera há mais tempo é drenado antes.
      const { data, error } = await servico
        .from("brand_deletions")
        .select("workspace_id")
        .eq("bucket_id", BUCKETS.assets)
        .order("requested_at", { ascending: true })
        .limit(1000);
      return { dados: (data ?? []).map((linha: { workspace_id: string }) => linha.workspace_id), erro: error };
    },
    drenar: (conta) =>
      drenarFilaDeExclusao({ supabase: servico, workspaceId: conta }, { bucket: BUCKETS.assets }),
    agora: () => Date.now(),
  }, { lote: LOTE });

  // Falha parcial é 500: o log do Cron precisa mostrar vermelho, não um 200
  // com a falha escondida no corpo.
  return NextResponse.json(resumo, { status: resumo.falhas.length > 0 ? 500 : 200 });
}
