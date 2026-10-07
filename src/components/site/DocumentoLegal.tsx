import Link from "next/link";
import type { ReactNode } from "react";
import type { DocumentoLegal as Documento } from "@/lib/site/documentos-legais";
import { Losango } from "./Losango";
import { Titulo } from "./Titulo";

/**
 * Termos e privacidade: o mesmo desenho, texto corrido em seções numeradas.
 *
 * O texto é dado (`documentos-legais.ts`) com três marcações: **negrito**,
 * parágrafo que começa com "- " vira item de lista, e [[pagina#ancora|texto]]
 * vira link entre os documentos.
 */
function trecho(texto: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g).filter(Boolean);
  return partes.map((parte, i) => {
    if (parte.startsWith("**")) return <strong key={i}>{parte.slice(2, -2)}</strong>;
    if (parte.startsWith("[[")) {
      const [destino, rotulo] = parte.slice(2, -2).split("|");
      return <Link key={i} href={`/${destino}`}>{rotulo}</Link>;
    }
    return parte;
  });
}

function blocos(paragrafos: readonly string[]): ReactNode[] {
  const saida: ReactNode[] = [];
  let lista: string[] = [];
  const fecharLista = () => {
    if (lista.length) saida.push(<ul key={`l${saida.length}`}>{lista.map((item) => <li key={item}>{trecho(item)}</li>)}</ul>);
    lista = [];
  };
  for (const p of paragrafos) {
    if (p.startsWith("- ")) { lista.push(p.slice(2)); continue; }
    fecharLista();
    saida.push(<p key={p}>{trecho(p)}</p>);
  }
  fecharLista();
  return saida;
}

export function DocumentoLegal({ titulo, migalha, documento }: { titulo: string; migalha: string; documento: Documento }) {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
        <div className="pg-wrap" style={{ paddingTop: "72px", maxWidth: "900px" }}>
          <p className="crumb"><a href="#" data-open-menu="m-rec">Recursos</a> · {migalha}</p>
          <Titulo como="h1" className="pg-h1" partes={[titulo]} />
          <p className="pg-lead">Em vigor desde {documento.vigenteDesde} · versão {documento.versao}</p>
        </div>
      </section>
      <section className="pg-sec">
        <div className="pg-wrap legal" data-documento-legal data-versao={documento.versao}>
          {documento.secoes.map((secao) => (
            <section key={secao.titulo} id={secao.id}>
              <h2>{secao.titulo}</h2>
              {blocos(secao.paragrafos)}
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
