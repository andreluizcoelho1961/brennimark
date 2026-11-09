/**
 * A fonte da assinatura de e-mail no Kit do assinante (14/10/2026).
 *
 * O e-mail não carrega a fonte da marca: quem recebe vê a que tem instalada.
 * Por isso a assinatura usa a SUBSTITUTA que o manual indica para o texto —
 * a fonte de sistema permitida onde a da marca não roda. Só a APROVADA (quem
 * chama filtra); prefere a do segmento digital, depois a sem segmento.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import type { Tradutor } from "../i18n/tradutor";

export type TextoDaTipografia = { segmento: string; substituta: string | null; pagina: number | null };

const DIGITAL = /digital|tela|web|online|screen|e-?mail/i;

/** `t` é o tradutor ligado a `ferramentas.kit`. */
export function fonteDaAssinatura(linhas: readonly TextoDaTipografia[], t: Tradutor): { nome: string; origem: string } | null {
  const comSubstituta = linhas.filter((l) => l.substituta && l.substituta.trim());
  const escolhida = comSubstituta.find((l) => l.segmento && DIGITAL.test(l.segmento))
    ?? comSubstituta.find((l) => !l.segmento)
    ?? comSubstituta[0];
  if (!escolhida) return null;
  return {
    nome: escolhida.substituta!.trim(),
    origem: escolhida.pagina ? t("assinatura.substitutaDoManual", { n: escolhida.pagina }) : t("assinatura.substitutaDaMarca"),
  };
}
