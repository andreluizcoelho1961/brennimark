import Link from "next/link";
import { CATEGORIAS, artigosDaCategoria } from "@/lib/ajuda/artigos";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Os artigos de uma categoria — `/ajuda/categoria/<slug>`. */
export function CategoriaDaAjuda({ slug }: { slug: string }) {
  const categoria = CATEGORIAS.find((c) => c.slug === slug)!;
  const artigos = artigosDaCategoria(slug);
  return (
    <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ paddingTop: "72px" }}>
        <p className="crumb"><Link href="/ajuda">Central de ajuda</Link> · {categoria.titulo}</p>
        <Titulo como="h1" className="pg-h1" partes={[categoria.titulo]} />
        <p className="pg-lead">{categoria.descricao}</p>
        <div className="related" style={{ marginTop: "48px" }}>
          {artigos.map((a) => (
            <Link key={a.slug} className="rel" href={`/ajuda/${a.slug}`}><b>{a.titulo}</b><span>{a.resumo}</span><em>→</em></Link>
          ))}
        </div>
      </div>
    </section>
  );
}
