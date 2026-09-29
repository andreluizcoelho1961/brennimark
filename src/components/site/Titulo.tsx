import type { CSSProperties, ReactNode } from "react";

/**
 * Um título que surge palavra por palavra.
 *
 * No protótipo, um script partia o texto depois que a página abria. Aqui a
 * divisão sai pronta do servidor, e o esconderijo inicial só existe quando o
 * site liga o movimento (`html[data-site-movimento]`, ver `MolduraDoSite`):
 * sem JavaScript, ou com movimento reduzido, o título aparece inteiro de uma
 * vez, e o buscador lê a frase como frase.
 *
 * `partes` alterna texto comum e trecho em destaque (`{ em: "…" }`); a
 * contagem de palavras corre pelas duas, para a cascata seguir a leitura.
 */
export type ParteDoTitulo = string | { em: string };

export function palavras(partes: readonly ParteDoTitulo[]): ReactNode[] {
  let i = 0;
  const dividir = (texto: string, chave: string) =>
    texto.split(/(\s+)/).map((pedaco, k) => {
      if (!pedaco) return null;
      if (/^\s+$/.test(pedaco)) return pedaco;
      const estilo = { "--i": i++ } as CSSProperties;
      return (
        <span className="w" key={`${chave}-${k}`}>
          <span style={estilo}>{pedaco}</span>
        </span>
      );
    });
  return partes.map((parte, n) =>
    typeof parte === "string" ? dividir(parte, `t${n}`) : <em key={`e${n}`}>{dividir(parte.em, `e${n}`)}</em>,
  );
}

type Nivel = "h1" | "h2" | "p";

export function Titulo({
  como: Tag = "h2",
  className,
  partes,
}: {
  como?: Nivel;
  className?: string;
  partes: readonly ParteDoTitulo[];
}) {
  return <Tag className={className ? `${className} split` : "split"}>{palavras(partes)}</Tag>;
}
