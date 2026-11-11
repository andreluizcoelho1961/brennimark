import { notFound } from "next/navigation";
import { IdiomaDaSessao } from "@/components/IdiomaDaSessao";
import { FormularioDeAssinatura } from "@/components/cobranca/FormularioDeAssinatura";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada da compra. A página real lê os planos à venda no banco; aqui eles
 * são fixos, e o teste de navegador finge `/api/cobranca/checkout`. Que o
 * preço sai do banco e o Piloto não sai pelo site está provado em
 * `scripts/prova-cobranca.sh`.
 */
export default async function BancadaDaCompra({ searchParams }: { searchParams: Promise<{ vazio?: string; plano?: string; escada?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { vazio, plano, escada } = await searchParams;
  const escadaNova = [
    ["uma-marca-com-ia", "Faísca · com IA", 1], ["uma-marca-sem-ia", "Faísca · traga a sua IA", 1],
    ["a-com-ia", "Ferro · com IA", 5], ["a-sem-ia", "Ferro · traga a sua IA", 5],
    ["b-com-ia", "Forja · com IA", 15], ["b-sem-ia", "Forja · traga a sua IA", 15],
    ["c-com-ia", "Brasa · com IA", 30], ["c-sem-ia", "Brasa · traga a sua IA", 30],
  ].map(([codigo, nome, maximoDeMarcas]) => ({ codigo: codigo as string, nome: nome as string, maximoDeMarcas: maximoDeMarcas as number }));
  const planos = vazio ? [] : escada ? escadaNova : [
    { codigo: "basico", nome: "Básico", maximoDeMarcas: 5 },
    { codigo: "medio", nome: "Médio", maximoDeMarcas: 15 },
    { codigo: "premium", nome: "Premium", maximoDeMarcas: 30 },
  ];
  return (
    <IdiomaDaSessao><main className="min-h-dvh bg-platform-bg p-8">
      <div className="mx-auto max-w-2xl"><FormularioDeAssinatura planos={planos} planoInicial={plano ?? null} /></div>
    </main></IdiomaDaSessao>
  );
}
