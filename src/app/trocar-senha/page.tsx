import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { senhaProvisoriaAte, senhaProvisoriaVencida } from "@/lib/acesso/senha-provisoria";
import { TrocaDeSenha } from "@/components/pessoas/TrocaDeSenha";

export const dynamic = "force-dynamic";

/**
 * Para onde a moldura manda quem tem senha provisória.
 *
 * Quem chega aqui sem senha provisória volta para dentro — não há o que
 * trocar. O prazo é lido da sessão, no servidor, e não de parâmetro do
 * endereço: o endereço é da pessoa, o prazo é do provedor.
 */
export default async function PaginaDaTrocaDeSenha() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ate = senhaProvisoriaAte(user.app_metadata);
  if (!ate) redirect("/");

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-page-inline py-24">
      <TrocaDeSenha email={user.email ?? ""} validaAte={ate.toISOString()} vencida={senhaProvisoriaVencida(ate)} />
    </main>
  );
}
