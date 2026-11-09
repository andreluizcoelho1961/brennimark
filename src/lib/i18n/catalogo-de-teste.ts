import fs from "node:fs";
import path from "node:path";
import type { Tradutor } from "./tradutor";

/**
 * Um `Tradutor` para os testes de unidade: lê o catálogo de verdade
 * (`src/i18n/mensagens/<idioma>.json`) e troca `{valor}` pelo valor dado.
 * Cobre só o que as funções de `src/lib` usam (chaves aninhadas e `{valor}`);
 * plural e marcação ficam com o `next-intl`, nas telas.
 */
export function tradutorDeTeste(espaco: string, idioma: "pt-BR" | "en" = "pt-BR"): Tradutor {
  const catalogo = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "i18n", "mensagens", `${idioma}.json`), "utf8"));
  const raiz = espaco.split(".").reduce((no, parte) => no?.[parte], catalogo);
  return (chave, valores = {}) => {
    const texto = chave.split(".").reduce((no, parte) => no?.[parte], raiz);
    if (typeof texto !== "string") throw new Error(`Falta a chave ${espaco}.${chave} (${idioma})`);
    return texto.replace(/\{(\w+)\}/g, (_m, nome: string) => String(valores[nome] ?? `{${nome}}`));
  };
}

export type SemTradutor<F> = F extends (...a: [...infer A, Tradutor]) => infer R ? (...a: A) => R : never;

/** Liga o `Tradutor` (último parâmetro) a uma função de `src/lib`, para os testes chamarem como antes. */
export function comTradutor<F extends (...a: never[]) => unknown>(f: F, t: Tradutor): SemTradutor<F> {
  return ((...a: unknown[]) => (f as unknown as (...x: unknown[]) => unknown)(...a, t)) as SemTradutor<F>;
}
