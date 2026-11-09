import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ehVisitanteDoTour, lerEstadoDoTour } from "@/lib/demonstracao/visitante";

/**
 * O estado do tour para a faixa da moldura (25/10/2026): quantas perguntas ao
 * Vini o visitante já fez, de quantas, e até quando vale a sessão.
 *
 * É uma rota COM sessão (fora de `caminhos-publicos.ts`). Quem não é visitante
 * do tour recebe `{ visitante: false }` e a faixa não aparece. O limite mora na
 * configuração, que só a chave de serviço lê; por isso a pergunta passa por aqui
 * e não direto pela RLS.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ehVisitanteDoTour(user)) return NextResponse.json({ visitante: false }, { headers });

  let servico;
  try { servico = createServiceClient(); } catch { return NextResponse.json({ visitante: false }, { headers }); }
  const { data } = await servico.rpc("demonstracao_estado", { p_user: user.id });
  const estado = lerEstadoDoTour(data);
  if (!estado) return NextResponse.json({ visitante: false }, { headers });
  return NextResponse.json({ visitante: true, ...estado }, { headers });
}
