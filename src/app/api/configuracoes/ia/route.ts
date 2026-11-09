import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import { capacidadesDe, modelosDe, podeAnalisarImagem } from "@/lib/ai/catalogo";
import { PROVIDERS, getModelCommercialInfo } from "@/lib/ai/provider";
import { PROVEDORES_DA_AGENCIA } from "@/lib/ai/rotas-da-agencia";
import { TERMO_VERSAO } from "@/lib/ia-propria/termo";

/**
 * Configurações › IA (ADR-0009, 07/11/2026): o estado da IA própria da conta.
 *
 * Só chega a quem administra, e a leitura é do banco, com a sessão de quem
 * pede: `listar_chaves_de_ia` confere de novo que é a dona e não devolve o
 * texto cifrado — só provedor, modelo e "termina em". A chave inteira nunca
 * volta por aqui nem por rota nenhuma.
 */
const SEM_CACHE = { "Cache-Control": "private, no-store" };

type Cliente = Awaited<ReturnType<typeof createClient>>;

/** O uso e o teto da conta, do jeito que a tela lê. `null` se o banco não respondeu. */
async function lerUso(supabase: Cliente, workspaceId: string) {
  const { data } = await supabase.rpc("uso_do_vini_da_conta", { p_workspace_id: workspaceId });
  const u = data as {
    franquia: number | null; franquia_do_plano: number | null; perguntas_de_pacotes: number; perguntas_no_mes: number; volta_em: string;
    teto_diario_micros: number | null; teto_mensal_micros: number | null;
    gasto_hoje_micros: number; gasto_no_mes_micros: number;
  } | null;
  if (!u) return null;
  return {
    franquia: u.franquia, franquiaDoPlano: u.franquia_do_plano, perguntasDePacotes: u.perguntas_de_pacotes ?? 0, perguntasNoMes: u.perguntas_no_mes, voltaEm: u.volta_em,
    tetoDiarioMicros: u.teto_diario_micros, tetoMensalMicros: u.teto_mensal_micros,
    gastoHojeMicros: u.gasto_hoje_micros, gastoNoMesMicros: u.gasto_no_mes_micros,
  };
}

export async function GET(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const supabase = await createClient();
  const { data: modo, error: erroDoModo } = await supabase.rpc("modo_de_ia_da_conta", { p_workspace_id: r.workspaceId });
  if (erroDoModo) return NextResponse.json({ message: "Não foi possível ler a IA da conta." }, { status: 500, headers: SEM_CACHE });
  const uso = await lerUso(supabase, r.workspaceId);
  // Conta que usa a IA da Brennimark não configura chave nenhuma. Só vê a franquia de perguntas,
  // se o plano tiver uma.
  if (modo !== "propria") return NextResponse.json({ modo: "plataforma", uso }, { headers: SEM_CACHE });

  const [chaves, termo] = await Promise.all([
    supabase.rpc("listar_chaves_de_ia", { p_workspace_id: r.workspaceId }),
    supabase.from("registros_da_ia_propria").select("versao_termo, criado_em")
      .eq("workspace_id", r.workspaceId).eq("acao", "aceitar-termo")
      .order("criado_em", { ascending: false }).limit(1),
  ]);
  if (chaves.error || termo.error) {
    return NextResponse.json({ message: "Não foi possível ler a IA da conta." }, { status: 500, headers: SEM_CACHE });
  }

  const aceite = (termo.data ?? [])[0] as { versao_termo: string; criado_em: string } | undefined;
  const provedores = PROVEDORES_DA_AGENCIA.map((p) => ({
    value: p,
    label: PROVIDERS.find((x) => x.value === p)?.label ?? p,
    modelos: modelosDe(p).map((m) => {
      const cap = capacidadesDe(m.provider, m.model);
      return {
        model: m.model,
        label: m.label,
        vision: cap ? podeAnalisarImagem(cap) : false,
        gratuito: getModelCommercialInfo(m.provider, m.model).billing === "free",
      };
    }),
  }));

  return NextResponse.json({
    modo: "propria",
    uso,
    termo: { aceito: !!aceite, vigente: aceite?.versao_termo === TERMO_VERSAO, versao: aceite?.versao_termo ?? null, em: aceite?.criado_em ?? null },
    termoVersaoAtual: TERMO_VERSAO,
    chaves: (chaves.data ?? []).map((c: { encaixe: string; provedor: string; modelo: string; chave_final: string; atualizada_em: string; testada_em: string | null; teste_ok: boolean | null }) => ({
      encaixe: c.encaixe, provedor: c.provedor, modelo: c.modelo, chaveFinal: c.chave_final,
      atualizadaEm: c.atualizada_em, testadaEm: c.testada_em, testeOk: c.teste_ok,
    })),
    provedores,
  }, { headers: SEM_CACHE });
}
