import type { DocumentoLegal as Documento } from "@/lib/site/documentos-legais";
import { Losango } from "./Losango";
import { Titulo } from "./Titulo";

/** Termos e privacidade: o mesmo desenho, texto corrido em seções numeradas. */
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
            <section key={secao.titulo}>
              <h2>{secao.titulo}</h2>
              {secao.paragrafos.map((p) => <p key={p}>{p}</p>)}
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
