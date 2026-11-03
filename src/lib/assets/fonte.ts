/**
 * A fonte da marca, hospedada (ADR-0007 §3, 03/11/2026).
 *
 * Só o que dá para decidir sem rede: que arquivo é de fonte, que licença o
 * item declara e o LEIA-ME que vai dentro do ZIP. O banco é quem recusa de
 * verdade (`brand_assets_fonte_*`); aqui a tela avisa antes de 25 MB subirem.
 *
 * Só formato de INSTALAR. Webfont (WOFF, WOFF2) não é hospedada: a regra é
 * "para baixar", nunca "para renderizar".
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const FORMATOS_DE_FONTE = { otf: "font/otf", ttf: "font/ttf", ttc: "font/collection" } as const;

/** O tipo MIME que a fonte DEVE declarar, pela extensão; `null` se não é de instalar. */
export function tipoDaFonte(nomeDoArquivo: string): string | null {
  const extensao = nomeDoArquivo.toLowerCase().match(/\.([^.]+)$/)?.[1];
  return extensao && extensao in FORMATOS_DE_FONTE ? FORMATOS_DE_FONTE[extensao as keyof typeof FORMATOS_DE_FONTE] : null;
}

export const LICENCAS = ["livre", "exclusiva", "comprada"] as const;
export type TipoDeLicenca = (typeof LICENCAS)[number];
export const ehLicenca = (v: unknown): v is TipoDeLicenca => typeof v === "string" && (LICENCAS as readonly string[]).includes(v);

const NOMES_DA_LICENCA: Record<TipoDeLicenca, { pt: string; en: string; aviso: { pt: string; en: string } }> = {
  livre: {
    pt: "Livre (por exemplo Google Fonts, licença SIL OFL)", en: "Free (for example Google Fonts, SIL OFL license)",
    aviso: { pt: "A licença permite redistribuir e usar a fonte.", en: "The license allows redistributing and using the font." },
  },
  exclusiva: {
    pt: "Exclusiva, desenhada para a marca", en: "Exclusive, designed for the brand",
    aviso: { pt: "A marca é dona da fonte e a libera a quem trabalha nela.", en: "The brand owns the font and releases it to whoever works on it." },
  },
  comprada: {
    pt: "Comprada de uma fundição", en: "Purchased from a foundry",
    aviso: {
      pt: "A licença costuma permitir uso por fornecedores do licenciado, e às vezes exige licença própria de cada um. Confira abaixo como obter.",
      en: "The license usually allows use by the licensee's suppliers, and sometimes requires each one to hold their own. See below how to get it.",
    },
  },
};

export type LicencaDoItem = { tipo: TipoDeLicenca; titular: string | null; comoObter: string | null };

/** A licença em frases, para a tela e para o LEIA-ME — a mesma, nos dois. */
export function frasesDaLicenca(l: LicencaDoItem, ingles: boolean): string[] {
  const k = ingles ? "en" : "pt";
  const linhas = [`${ingles ? "License" : "Licença"}: ${NOMES_DA_LICENCA[l.tipo][k]}`, NOMES_DA_LICENCA[l.tipo].aviso[k]];
  if (l.titular) linhas.push(`${ingles ? "Holder" : "Titular"}: ${l.titular}`);
  if (l.comoObter) linhas.push(`${ingles ? "How to get it" : "Como obter"}: ${l.comoObter}`);
  return linhas;
}

/** O LEIA-ME de um kit que leva fontes: licença, o que fazer e como instalar. */
export function leiaMeDeFontes(dados: { marca: string; item: string; arquivos: string[]; licenca: LicencaDoItem | null; ingles: boolean }): string {
  const { marca, item, arquivos, licenca, ingles } = dados;
  const t = (pt: string, en: string) => (ingles ? en : pt);
  return [
    t(`${marca} — ${item}`, `${marca} — ${item}`),
    "",
    t("Estas são as fontes oficiais da marca, entregues pelo Brennimark a quem a marca autorizou.", "These are the brand's official fonts, delivered by Brennimark to whoever the brand authorized."),
    "",
    t("Arquivos:", "Files:"),
    ...arquivos.map((a) => `  - ${a}`),
    "",
    ...(licenca ? [t("LICENÇA", "LICENSE"), ...frasesDaLicenca(licenca, ingles).map((l) => `  ${l}`), ""] : []),
    t("USO", "USE"),
    t("  Use a fonte só para trabalhos da marca. Não a repasse a quem não trabalha nela e não a publique em endereço público.", "  Use the font only for the brand's work. Do not pass it on to anyone who does not work on the brand and do not publish it at a public address."),
    "",
    t("COMO INSTALAR", "HOW TO INSTALL"),
    t("  Mac: abra o arquivo (duplo clique) e clique em “Instalar fonte”. Ou arraste para o Catálogo de Fontes.", "  Mac: open the file (double-click) and click “Install Font”. Or drag it into Font Book."),
    t("  Windows: clique com o botão direito no arquivo e escolha “Instalar” (ou “Instalar para todos os usuários”).", "  Windows: right-click the file and choose “Install” (or “Install for all users”)."),
    t("  Depois, feche e abra de novo o InDesign, o Illustrator ou o Photoshop para a fonte aparecer.", "  Then close and reopen InDesign, Illustrator or Photoshop so the font shows up."),
    t("  Se o arquivo for .ttc, ele traz várias fontes numa só: instalar uma vez instala todas.", "  A .ttc file holds several fonts in one: installing it once installs them all."),
    "",
  ].join("\n");
}

/** O LEIA-ME do kit da marca inteira: o que há em cada pasta, e as fontes à parte. */
export function leiaMeDaMarca(dados: {
  marca: string; pastas: { pasta: string; arquivos: number }[]; fontes: { item: string; licenca: LicencaDoItem | null }[]; ingles: boolean;
}): string {
  const { marca, pastas, fontes, ingles } = dados;
  const t = (pt: string, en: string) => (ingles ? en : pt);
  return [
    t(`${marca} — todos os materiais`, `${marca} — all materials`),
    "",
    t("O que há em cada pasta:", "What is in each folder:"),
    ...pastas.map((p) => `  ${p.pasta}  (${p.arquivos})`),
    "",
    t("Só entra o que está em uso na biblioteca. Fotos e ilustrações ficam no Banco de imagens, com download próprio.", "Only what is in use in the library is included. Photos and illustrations live in the Image bank, with their own download."),
    "",
    ...(fontes.length > 0
      ? [
          t("FONTES", "FONTS"),
          t("  As pastas de fonte trazem os arquivos para instalar (.otf, .ttf, .ttc). Mac: duplo clique e “Instalar fonte”. Windows: botão direito e “Instalar”.", "  The font folders hold the files to install (.otf, .ttf, .ttc). Mac: double-click and “Install Font”. Windows: right-click and “Install”."),
          ...fontes.flatMap((f) => [`  ${f.item}`, ...(f.licenca ? frasesDaLicenca(f.licenca, ingles).map((l) => `    ${l}`) : [])]),
          "",
        ]
      : []),
  ].join("\n");
}
