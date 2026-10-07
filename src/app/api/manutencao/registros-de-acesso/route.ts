import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { segredoDoCronConfere } from "@/lib/assets/limpeza-de-orfaos";

/**
 * A limpeza dos registros de acesso com mais de 6 meses (Marco Civil, art. 15:
 * o mínimo é 6 meses; a LGPD pede não guardar além). Chamada pelo Vercel
 * Cron uma vez por dia (`vercel.json`), com o mesmo segredo da limpeza de
 * materiais. Quem decide o que sai é a função `service_role`-only no banco.
 */
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
  const { data, error } = await servico.rpc("limpar_registros_de_acesso");
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "limpeza_de_registros_falhou", code: error.code ?? "unknown" }));
    return NextResponse.json({ message: "A limpeza falhou." }, { status: 500 });
  }
  console.info(JSON.stringify({ level: "info", msg: "limpeza_de_registros", removidos: data }));
  return NextResponse.json({ removidos: data });
}
