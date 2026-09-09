/**
 * O que dizer a quem espera a publicação terminar.
 *
 * Publicar um manual de identidade leva MINUTOS: cada página visual é
 * renderizada em escala 2 antes de qualquer gravação. O botão dizia
 * "Publicando…" do início ao fim, e uma espera longa e muda é indistinguível de
 * um travamento — foi diagnosticada como travamento inclusive por quem conhecia
 * o código. Numa demonstração, quem espera desiste antes de o produto terminar.
 *
 * Vive fora do componente porque é a regra, e regra se testa sem navegador.
 */
export type EtapaDaPublicacao = "renderizando" | "enviando" | "gravando";

export interface ProgressoDaPublicacao {
  etapa: EtapaDaPublicacao;
  feito: number;
  total: number;
}

/**
 * Etapa e contagem, deliberadamente — nunca uma porcentagem única.
 *
 * As fases têm custos de ordens diferentes: renderizar uma página leva
 * segundos, enviá-la leva frações. Uma barra só espremeria isso num número que
 * anda devagar no começo e salta no fim, o que é uma mentira sobre o tempo que
 * falta. "Renderizando página 7 de 25" é verificável por quem olha a tela;
 * "43%" não é.
 */
export function rotuloDoProgresso(
  progresso: ProgressoDaPublicacao | null,
  t: (pt: string, en: string) => string,
): string {
  if (!progresso) return t("Publicando…", "Publishing…");

  const { etapa, feito, total } = progresso;
  if (etapa === "gravando") return t("Gravando a marca…", "Saving the brand…");

  // Sem total não há contagem honesta a fazer, e "0 de 0" seria pior que o
  // genérico: sugere trabalho que não existe.
  if (total <= 0) return t("Publicando…", "Publishing…");

  return etapa === "renderizando"
    ? t(`Renderizando página ${feito} de ${total}…`, `Rendering page ${feito} of ${total}…`)
    : t(`Enviando imagem ${feito} de ${total}…`, `Uploading image ${feito} of ${total}…`);
}
