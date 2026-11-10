import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Pagamentos de pacote avulso cobrados e NÃO creditados (auditoria de 09/11/2026, M1): os avisos do
 * Stripe de checkout que ficaram em `falhou` em `eventos_de_cobranca`. O Stripe repete o aviso por
 * dias; se a causa se resolve, o próximo aviso credita e a linha some (vira `processado`).
 *
 * Só a equipe: `sou_da_equipe_brennimark` decide com a sessão de quem pede, e só depois a leitura usa
 * a chave de serviço (a tabela não tem policy: fechada a qualquer sessão). Para os outros, 404.
 * O conserto manual está em `docs/plan/pacote-pago-sem-credito.md`.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: daEquipe } = await supabase.rpc("sou_da_equipe_brennimark");
  if (daEquipe !== true) return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  let servico;
  try { servico = createServiceClient(); } catch {
    return NextResponse.json({ message: "A chave de serviço não está configurada." }, { status: 503 });
  }
  const { data, error } = await servico.from("eventos_de_cobranca")
    .select("id_externo, tipo, detalhe, tentativas, recebido_em")
    .eq("resultado", "falhou").like("tipo", "checkout.session.%")
    .order("recebido_em", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ message: "Não foi possível ler os avisos." }, { status: 500 });
  return NextResponse.json({ avisos: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}
