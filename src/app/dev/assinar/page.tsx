import { notFound } from "next/navigation";
import { FormularioDeAssinatura } from "@/components/cobranca/FormularioDeAssinatura";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada da compra. A página real lê os planos à venda no banco; aqui eles
 * são fixos, e o teste de navegador finge `/api/cobranca/checkout`. Que o
 * preço sai do banco e o Piloto não sai pelo site está provado em
 * `scripts/prova-cobranca.sh`.
 */
export default async function BancadaDaCompra({ searchParams }: { searchParams: Promise<{ vazio?: string; plano?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { vazio, plano } = await searchParams;
  const planos = vazio ? [] : [
    { codigo: "basico", nome: "Básico", maximoDeMarcas: 5 },
    { codigo: "medio", nome: "Médio", maximoDeMarcas: 15 },
    { codigo: "premium", nome: "Premium", maximoDeMarcas: 30 },
  ];
  return (
    <main className="min-h-dvh bg-platform-bg p-8">
      <div className="mx-auto max-w-2xl"><FormularioDeAssinatura planos={planos} planoInicial={plano ?? null} /></div>
    </main>
  );
}
