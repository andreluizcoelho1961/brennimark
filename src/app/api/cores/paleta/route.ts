import { NextResponse } from "next/server";
import { conteudoDaRota } from "@/lib/brennimark/contexto-da-rota";
import { lerPaleta } from "@/lib/paleta/paleta";

/**
 * A paleta da marca para o Cores do assinante (10/10/2026): lida pela sessão
 * (a RLS só devolve a quem consulta esta marca). Vai com o status: o Cores só
 * chama de "cor da marca" a aprovada, e mostra o rascunho identificado.
 */
export async function GET(request: Request) {
  const r = await conteudoDaRota(request);
  if (!r.ok) return r.resposta;
  if (!r.contexto.brand) return NextResponse.json({ error: "sem_marca" }, { status: 409 });
  const lida = await lerPaleta(r.auth.supabase, r.contexto.brand.id);
  if (!lida.ok) return NextResponse.json({ message: "Não foi possível ler a paleta agora." }, { status: 503 });
  return NextResponse.json({
    marca: r.contexto.brand.brand.name,
    paleta: lida.cores.filter((c) => c.hex).map((c) => ({
      nome: c.nome, hex: c.hex, status: c.status, pagina: c.pagina, cmyk: c.cmyk, pms: c.pms, rgb: c.rgb,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
