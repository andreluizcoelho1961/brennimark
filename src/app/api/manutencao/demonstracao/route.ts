import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { segredoDoCronConfere } from "@/lib/assets/limpeza-de-orfaos";
import { rodarLimpezaDoTour } from "@/lib/demonstracao/limpeza";

/**
 * A limpeza diária do tour — chamada pelo Vercel Cron (`vercel.json`). A
 * decisão vive em `@/lib/demonstracao/limpeza`; aqui só as portas reais.
 *
 * Quem chama: ninguém com sessão. O Vercel Cron manda `Authorization: Bearer
 * ${CRON_SECRET}`; sem ele, 401 antes de qualquer cliente existir. O `proxy`
 * deixa `/api/manutencao/` passar sem sessão — a trava é ESTA.
 *
 * Apaga só usuário do tour: o banco só lista esses, e a porta `ehDoTour`
 * confere de novo no próprio usuário antes de cada `deleteUser`.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!segredoDoCronConfere(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }
  let servico;
  try { servico = createServiceClient(); } catch {
    return NextResponse.json({ message: "A chave de serviço não está configurada." }, { status: 503 });
  }

  const lista = async (rpc: "demonstracao_vencidos" | "demonstracao_orfaos") => {
    const { data, error } = await servico.rpc(rpc);
    if (error) throw new Error(`${rpc}: ${error.code}`);
    return (data ?? []) as string[];
  };

  const resumo = await rodarLimpezaDoTour({
    vencidos: () => lista("demonstracao_vencidos"),
    orfaos: () => lista("demonstracao_orfaos"),
    async ehDoTour(userId) {
      const { data, error } = await servico.auth.admin.getUserById(userId);
      if (error || !data.user) return false;
      return data.user.app_metadata?.tour === true || data.user.is_anonymous === true;
    },
    async apagar(userId) {
      const { error } = await servico.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.status ?? "erro"}`);
    },
  });

  console.info(JSON.stringify({ level: resumo.falhas.length ? "error" : "info", msg: "demonstracao_limpeza", ...resumo }));
  return NextResponse.json(resumo, { status: resumo.falhas.length > 0 ? 500 : 200 });
}
