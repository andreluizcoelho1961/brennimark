/**
 * Os tamanhos do Brennimark Kit (09/10/2026) — UMA tabela, para trocar um
 * tamanho ser trocar uma linha (especificação v2, §3 e §5).
 *
 * Redes e plataformas mudam medidas. Cada item diz de onde a medida veio:
 *   - `conferido`: lida na documentação da própria plataforma na data indicada
 *     (a especificação proíbe chutar Gupy, Glassdoor e afins);
 *   - `especificacao`: tamanho de envio usual das redes grandes, da
 *     especificação de 08/10 — maior ou igual ao mínimo de cada rede.
 * Plataforma cuja medida não foi confirmada (Indeed, Vagas, Catho, InfoJobs)
 * fica FORA até ser.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

import type { Tradutor } from "../i18n/tradutor";

export type Grupo = "site" | "redes" | "endomarketing" | "email" | "apresentacao";

/** Como o desenho entra na imagem. */
export type Formato =
  | "quadrado" // ícone ou logo de página: o desenho centrado
  | "circulo" // perfil de rede: a plataforma recorta em círculo
  | "faixa" // capa e banner: o desenho centrado, no máximo meia altura
  | "videochamada" // a marca no canto, o centro livre para o rosto
  | "transparente"; // arquivo de logo sem fundo, na proporção do desenho

export type Fonte = { tipo: "conferido"; url: string; em: string } | { tipo: "especificacao" };

export type ItemDoKit = {
  grupo: Grupo;
  arquivo: string;
  largura: number;
  /** 0: segue a proporção do desenho (só em `transparente`). */
  altura: number;
  formato: Formato;
  /** Área segura, em fração da imagem (o YouTube corta o banner por aparelho). */
  seguro?: { largura: number; altura: number };
  /** Ícone adaptável do Android: o desenho dentro do círculo de 80%. */
  circuloSeguro?: number;
  /**
   * Qual desenho (10/10/2026): `pequeno` (quadrados e círculos) usa o símbolo,
   * senão o logotipo vertical, senão o horizontal; `logo` (faixas) usa o
   * horizontal; `simbolo` e `vertical` só entram se a marca os tiver.
   */
  desenho?: "pequeno" | "logo" | "simbolo" | "vertical";
  tom?: "original" | "negativo" | "uma-cor";
  /** Entra no favicon.ico. */
  ico?: true;
  fonte: Fonte;
};

const ESPEC: Fonte = { tipo: "especificacao" };
const conferido = (url: string): Fonte => ({ tipo: "conferido", url, em: "2026-10-09" });

const LINKEDIN = conferido("https://www.linkedin.com/help/linkedin/answer/14");
// A página de especificações de imagem das Páginas do LinkedIn, conferida em
// 13/10/2026: a capa MUDOU de 1128 × 191 para 1512 × 256 (achado ao conferir as
// medidas do Brennimark Grids); logo 400 × 400 recomendado (268 mínimo).
const LINKEDIN_PAGINAS: Fonte = { tipo: "conferido", url: "https://www.linkedin.com/help/linkedin/answer/a563309", em: "2026-10-13" };
const GLASSDOOR_LOGO = conferido("https://help.glassdoor.com/s/article/Add-or-update-your-logo?language=en_US");
const GLASSDOOR_CAPA = conferido("https://help.glassdoor.com/s/article/Upload-a-cover-photo-or-cover-video?language=en_US");
const GUPY = conferido("https://suporte.gupy.io/s/suporte/article/Como-criar-e-configurar-sua-pagina-de-carreira-na-Gupy?language=pt_BR");
const VIVA = conferido("https://support.microsoft.com/en-us/viva/engage/manage-a-community-in-viva-engage");
const WORKSPACE = conferido("https://support.google.com/a/answer/96474");

export const ITENS_DO_KIT: readonly ItemDoKit[] = [
  // ─── Site ────────────────────────────────────────────────────────────────
  { grupo: "site", arquivo: "favicon-16.png", largura: 16, altura: 16, formato: "quadrado", desenho: "pequeno", ico: true, fonte: ESPEC },
  { grupo: "site", arquivo: "favicon-32.png", largura: 32, altura: 32, formato: "quadrado", desenho: "pequeno", ico: true, fonte: ESPEC },
  { grupo: "site", arquivo: "favicon-48.png", largura: 48, altura: 48, formato: "quadrado", desenho: "pequeno", ico: true, fonte: ESPEC },
  { grupo: "site", arquivo: "apple-touch-icon.png", largura: 180, altura: 180, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
  { grupo: "site", arquivo: "android-192.png", largura: 192, altura: 192, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
  { grupo: "site", arquivo: "android-512.png", largura: 512, altura: 512, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
  { grupo: "site", arquivo: "android-adaptavel-512.png", largura: 512, altura: 512, formato: "quadrado", desenho: "pequeno", circuloSeguro: 0.8, fonte: ESPEC },
  { grupo: "site", arquivo: "compartilhamento-1200x630.png", largura: 1200, altura: 630, formato: "faixa", desenho: "logo", fonte: ESPEC },

  // ─── Redes sociais ───────────────────────────────────────────────────────
  { grupo: "redes", arquivo: "instagram-perfil-1080.png", largura: 1080, altura: 1080, formato: "circulo", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "facebook-perfil-720.png", largura: 720, altura: 720, formato: "circulo", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "facebook-capa-1640x624.png", largura: 1640, altura: 624, formato: "faixa", desenho: "logo", fonte: ESPEC },
  { grupo: "redes", arquivo: "linkedin-logo-400.png", largura: 400, altura: 400, formato: "quadrado", desenho: "pequeno", fonte: LINKEDIN_PAGINAS },
  { grupo: "redes", arquivo: "linkedin-capa-1512x256.png", largura: 1512, altura: 256, formato: "faixa", desenho: "logo", fonte: LINKEDIN_PAGINAS },
  { grupo: "redes", arquivo: "x-perfil-400.png", largura: 400, altura: 400, formato: "circulo", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "x-capa-1500x500.png", largura: 1500, altura: 500, formato: "faixa", desenho: "logo", fonte: ESPEC },
  { grupo: "redes", arquivo: "youtube-perfil-800.png", largura: 800, altura: 800, formato: "circulo", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "youtube-banner-2560x1440.png", largura: 2560, altura: 1440, formato: "faixa", desenho: "logo", seguro: { largura: 1546 / 2560, altura: 423 / 1440 }, fonte: ESPEC },
  { grupo: "redes", arquivo: "tiktok-perfil-720.png", largura: 720, altura: 720, formato: "circulo", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "whatsapp-business-640.png", largura: 640, altura: 640, formato: "circulo", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "pinterest-perfil-600.png", largura: 600, altura: 600, formato: "circulo", desenho: "pequeno", fonte: ESPEC },

  // ─── Endomarketing e employer branding ───────────────────────────────────
  { grupo: "endomarketing", arquivo: "linkedin-vitrine-capa-1512x256.png", largura: 1512, altura: 256, formato: "faixa", desenho: "logo", fonte: LINKEDIN_PAGINAS },
  { grupo: "endomarketing", arquivo: "linkedin-vida-1128x376.png", largura: 1128, altura: 376, formato: "faixa", desenho: "logo", fonte: LINKEDIN_PAGINAS },
  { grupo: "endomarketing", arquivo: "linkedin-evento-capa-1776x444.png", largura: 1776, altura: 444, formato: "faixa", desenho: "logo", fonte: LINKEDIN },
  { grupo: "endomarketing", arquivo: "gupy-carreiras-760x430.png", largura: 760, altura: 430, formato: "faixa", desenho: "logo", fonte: GUPY },
  { grupo: "endomarketing", arquivo: "gupy-vaga-topo-1980x600.png", largura: 1980, altura: 600, formato: "faixa", desenho: "logo", fonte: GUPY },
  { grupo: "endomarketing", arquivo: "glassdoor-logo-512.png", largura: 512, altura: 512, formato: "quadrado", desenho: "pequeno", fonte: GLASSDOOR_LOGO },
  { grupo: "endomarketing", arquivo: "glassdoor-capa-2880x550.png", largura: 2880, altura: 550, formato: "faixa", desenho: "logo", fonte: GLASSDOOR_CAPA },
  { grupo: "endomarketing", arquivo: "viva-engage-capa-1400x524.png", largura: 1400, altura: 524, formato: "faixa", desenho: "logo", fonte: VIVA },
  { grupo: "endomarketing", arquivo: "teams-equipe-240.png", largura: 240, altura: 240, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
  { grupo: "endomarketing", arquivo: "slack-espaco-512.png", largura: 512, altura: 512, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
  { grupo: "endomarketing", arquivo: "google-workspace-logo-320x132.png", largura: 320, altura: 132, formato: "faixa", desenho: "logo", fonte: WORKSPACE },
  { grupo: "endomarketing", arquivo: "fundo-videochamada-1920x1080.png", largura: 1920, altura: 1080, formato: "videochamada", desenho: "logo", fonte: ESPEC },
  { grupo: "endomarketing", arquivo: "papel-de-parede-1920x1080.png", largura: 1920, altura: 1080, formato: "faixa", desenho: "logo", seguro: { largura: 0.5, altura: 0.5 }, fonte: ESPEC },
  { grupo: "endomarketing", arquivo: "papel-de-parede-2560x1440.png", largura: 2560, altura: 1440, formato: "faixa", desenho: "logo", seguro: { largura: 0.5, altura: 0.5 }, fonte: ESPEC },

  // ─── E-mail ──────────────────────────────────────────────────────────────
  { grupo: "email", arquivo: "assinatura-logo-600.png", largura: 600, altura: 0, formato: "transparente", desenho: "logo", fonte: ESPEC },

  // ─── Apresentação e uso geral ────────────────────────────────────────────
  { grupo: "apresentacao", arquivo: "logotipo-2000.png", largura: 2000, altura: 0, formato: "transparente", desenho: "logo", tom: "original", fonte: ESPEC },
  { grupo: "apresentacao", arquivo: "logotipo-negativo-2000.png", largura: 2000, altura: 0, formato: "transparente", desenho: "logo", tom: "negativo", fonte: ESPEC },
  { grupo: "apresentacao", arquivo: "logotipo-uma-cor-2000.png", largura: 2000, altura: 0, formato: "transparente", desenho: "logo", tom: "uma-cor", fonte: ESPEC },
  { grupo: "apresentacao", arquivo: "logotipo-vertical-2000.png", largura: 2000, altura: 0, formato: "transparente", desenho: "vertical", tom: "original", fonte: ESPEC },
  { grupo: "apresentacao", arquivo: "simbolo-2000.png", largura: 2000, altura: 0, formato: "transparente", desenho: "simbolo", tom: "original", fonte: ESPEC },
  { grupo: "apresentacao", arquivo: "avatar-512.png", largura: 512, altura: 512, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
];

/** O nome de cada grupo vem do catálogo (`grupos.<id>`), e o da pasta no .zip também (`pastas.<id>`). */
export const GRUPOS_DO_KIT: readonly { id: Grupo }[] = [{ id: "site" }, { id: "redes" }, { id: "endomarketing" }, { id: "email" }, { id: "apresentacao" }];

/** A pasta do grupo dentro do .zip, no idioma de `t` (ligado a `ferramentas.kit`). */
export function pastaDoGrupo(grupo: Grupo, t: Tradutor): string {
  return t(`pastas.${grupo}`);
}

/**
 * O nome do arquivo que o Kit GERA, no idioma de quem baixa. `item.arquivo` é só
 * o identificador interno (a tabela, os testes); o nome que sai no .zip é do catálogo.
 */
export function nomeDoArquivo(item: Pick<ItemDoKit, "arquivo">, t: Tradutor): string {
  return t(`arquivos.${item.arquivo.replace(/\.png$/, "")}`);
}

/** Os itens que têm observação no catálogo (os demais mostram só o nome e a medida). */
const COM_OBSERVACAO: ReadonlySet<string> = new Set([
  "android-adaptavel-512.png", "compartilhamento-1200x630.png", "linkedin-capa-1512x256.png", "youtube-banner-2560x1440.png",
  "linkedin-vitrine-capa-1512x256.png", "linkedin-vida-1128x376.png", "gupy-carreiras-760x430.png", "glassdoor-logo-512.png",
  "glassdoor-capa-2880x550.png", "google-workspace-logo-320x132.png", "fundo-videochamada-1920x1080.png", "assinatura-logo-600.png",
]);

/** O nome e a observação de um item, no idioma de `t` (ligado a `ferramentas.kit`). */
export function textoDoItem(item: Pick<ItemDoKit, "arquivo">, t: Tradutor): { nome: string; obs?: string } {
  const chave = item.arquivo.replace(/\.png$/, "");
  return { nome: t(`itens.${chave}.nome`), obs: COM_OBSERVACAO.has(item.arquivo) ? t(`itens.${chave}.obs`) : undefined };
}
