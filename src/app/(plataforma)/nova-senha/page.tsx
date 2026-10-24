import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NovaSenha } from "@/components/acesso/NovaSenha";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nova senha · Brennimark", robots: { index: false, follow: false } };

/**
 * Onde o link de "Esqueci a senha" chega, já com a sessão aberta pelo
 * provedor. Quem chega sem sessão vai pedir o link.
 */
export default async function PaginaDaNovaSenha({ searchParams }: { searchParams: Promise<{ r?: string | string[] }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/esqueci-senha");
  const { r } = await searchParams;
  const segredo = typeof r === "string" && /^[0-9a-f]{64}$/.test(r) ? r : null;
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-page-inline py-24">
      <NovaSenha email={user.email ?? ""} segredo={segredo} />
    </main>
  );
}
