"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Item = { slug: string; titulo: string; resumo: string; texto: string };

/** Sem acento e sem caixa: "cor" encontra "Côr", "assinatura" encontra "Assinatura". */
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * A busca da Central de ajuda (17/10/2026). Roda no navegador sobre o índice
 * que o servidor entrega — poucos artigos, nenhum pedido de rede por tecla.
 * O título pesa mais que o resumo, e o resumo mais que o corpo.
 */
export function BuscaDaAjuda({ indice }: { indice: Item[] }) {
  const [consulta, setConsulta] = useState("");

  const resultados = useMemo(() => {
    const termos = normalizar(consulta).split(/\s+/).filter(Boolean);
    if (termos.length === 0) return [];
    return indice
      .map((a) => {
        const t = normalizar(a.titulo), r = normalizar(a.resumo), c = normalizar(a.texto);
        if (!termos.every((x) => t.includes(x) || r.includes(x) || c.includes(x))) return null;
        const pontos = termos.reduce((n, x) => n + (t.includes(x) ? 3 : 0) + (r.includes(x) ? 2 : 0) + (c.includes(x) ? 1 : 0), 0);
        return { a, pontos };
      })
      .filter((x): x is { a: Item; pontos: number } => x !== null)
      .sort((x, y) => y.pontos - x.pontos)
      .map((x) => x.a);
  }, [consulta, indice]);

  return (
    <div className="ajuda-busca">
      <div className="hsearch">
        <span aria-hidden="true">⌕</span>
        <input type="search" value={consulta} onChange={(e) => setConsulta(e.target.value)}
          placeholder="Busque por um assunto: link de entrega, fonte, Vini…" aria-label="Buscar na central de ajuda" />
      </div>
      {consulta.trim() !== "" && (
        <div className="ajuda-resultados" role="status" aria-live="polite">
          {resultados.length === 0 ? (
            <p>Nenhum artigo encontrado para “{consulta.trim()}”. Fale com o <Link href="/suporte">suporte</Link>.</p>
          ) : (
            <ul>
              {resultados.map((a) => (
                <li key={a.slug}><Link href={`/ajuda/${a.slug}`}><b>{a.titulo}</b><span>{a.resumo}</span></Link></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
