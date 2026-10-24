import { getTranslations } from "next-intl/server";

/**
 * A janela do Brennimark Fonts, desenhada (23/10/2026). Usada na página /fonts e
 * no capítulo do Fonts da home. É um desenho: o aplicativo é um programa do
 * computador (não roda no navegador), e esta tela mostra o que o beta faz hoje —
 * famílias de uma marca, um kit pronto para ativar e um conflito de nomes avisado.
 * Os textos moram em `site.janelaDoFonts`.
 */
export async function JanelaDoFonts() {
  const t = await getTranslations("site.janelaDoFonts");
  return (
      <div className="frame"><div className="mk" role="img" aria-label={t("aria")}><div className="mk-bar"><b>Brennimark Fonts</b><span className="a-direita mono" style={{ fontSize: "10px", color: "var(--app-muted)" }}>{t("beta")}</span></div><div className="mk-body fx-demo">
      <div><b>{t("kit")}</b><span>{t("kitInfo")}</span><em>{t("ativarKit")}</em></div>
      <div><b>{t("serifada")}</b><span>{t("serifadaInfo")}</span><em>{t("desativar")}</em></div>
      <div><b>{t("sans")}</b><span>{t("sansInfo")}</span><em>{t("ativar")}</em></div>
      <div className="fx-aviso"><b>{t("conflito")}</b><span>{t("conflitoInfo")}</span><em>{t("diferenca")}</em></div></div></div></div>
  );
}
