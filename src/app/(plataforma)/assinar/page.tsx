import { createClient } from "@/lib/supabase/server";
import { FormularioDeAssinatura, type PlanoAVenda } from "@/components/cobranca/FormularioDeAssinatura";

export const metadata = { title: "Assinar · Brennimark", robots: { index: false, follow: false } };

/**
 * Assinar (cobrança, fatia 2). Quem chega aqui ainda não tem conta: a página
 * passa pelo `proxy` sem sessão e lê só os planos À VENDA, que são públicos.
 *
 * O valor de cada plano mora no Stripe e aparece na página de pagamento dele;
 * aqui ficam o que o plano inclui e a escolha da moeda.
 */
export default async function AssinarPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const { plano } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("planos")
    .select("codigo, nome, maximo_de_marcas")
    .eq("a_venda", true)
    .order("ordem");
  const planos: PlanoAVenda[] = (data ?? []).map((p) => ({ codigo: p.codigo, nome: p.nome, maximoDeMarcas: p.maximo_de_marcas }));

  return (
    <main className="flex min-h-full flex-1 justify-center px-page-inline py-16">
      <div className="w-full max-w-2xl">
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-platform-text">Brennimark</p>
        <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] text-platform-text">Assinar</h1>
        <p className="mt-4 max-w-[36rem] text-sm leading-relaxed text-platform-text-muted">
          Planos pelo número de marcas. Pessoas, ilimitadas. O pagamento é feito na página segura do Stripe; a conta é
          criada assim que ele for confirmado.
        </p>
        <FormularioDeAssinatura planos={planos} planoInicial={plano ?? null} />
      </div>
    </main>
  );
}
