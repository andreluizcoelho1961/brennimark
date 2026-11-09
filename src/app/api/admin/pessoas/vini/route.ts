import { NextResponse } from "next/server";
import { inEnglish } from "@/platform/locale";
import { idiomaDaSessao } from "@/lib/idioma-da-sessao";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import { createClient } from "@/lib/supabase/server";
import { normalizarEmail } from "@/lib/acesso/pessoas";

/**
 * Pessoas e acesso › "usa o Vini" (ADR-0009 §5, 08/11/2026).
 *
 * A dona da conta liga ou desliga o Vini para uma pessoa de consulta. Quem decide é o banco:
 * `definir_uso_do_vini` confere que quem pede administra a conta e que a pessoa é de consulta
 * DESTA conta; e a reserva de execução do Vini recusa quem está desligado, mesmo chamando a rota
 * de IA por fora da tela. Esta rota só traduz a recusa.
 */
const SEM_CACHE = { "Cache-Control": "private, no-store" };

export async function PUT(request: Request) {
  const isEnglish = inEnglish(await idiomaDaSessao());
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;

  const corpo = (await request.json().catch(() => null)) as { email?: unknown; ligado?: unknown } | null;
  const email = normalizarEmail(corpo?.email);
  if (!email || typeof corpo?.ligado !== "boolean") {
    return NextResponse.json({ message: isEnglish ? "Check the details." : "Revise os dados." }, { status: 400, headers: SEM_CACHE });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("definir_uso_do_vini", {
    p_workspace_id: r.workspaceId, p_email: email, p_ligado: corpo.ligado,
  });
  if (error?.code === "42501") {
    return NextResponse.json({
      message: isEnglish ? "Only an administrator can turn Vini on or off." : "Só quem administra a conta liga ou desliga o Vini.",
    }, { status: 403, headers: SEM_CACHE });
  }
  if (error?.code === "22023") {
    return NextResponse.json({
      message: isEnglish
        ? "This person isn't a consulting member of this account yet. Administrators always use Vini."
        : "Esta pessoa ainda não é de consulta nesta conta. Quem administra sempre usa o Vini.",
    }, { status: 409, headers: SEM_CACHE });
  }
  if (error) {
    return NextResponse.json({ message: isEnglish ? "Couldn't save." : "Não foi possível guardar." }, { status: 500, headers: SEM_CACHE });
  }
  return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
}
