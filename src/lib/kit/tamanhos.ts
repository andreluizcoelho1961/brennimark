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
  nome: string;
  largura: number;
  /** 0: segue a proporção do desenho (só em `transparente`). */
  altura: number;
  formato: Formato;
  /** Área segura, em fração da imagem (o YouTube corta o banner por aparelho). */
  seguro?: { largura: number; altura: number };
  /** Ícone adaptável do Android: o desenho dentro do círculo de 80%. */
  circuloSeguro?: number;
  /** Qual desenho: o símbolo (se houver) nos tamanhos pequenos, ou sempre o logo. */
  desenho?: "pequeno" | "logo" | "simbolo";
  tom?: "original" | "negativo" | "uma-cor";
  /** Entra no favicon.ico. */
  ico?: true;
  obs?: string;
  fonte: Fonte;
};

const ESPEC: Fonte = { tipo: "especificacao" };
const conferido = (url: string): Fonte => ({ tipo: "conferido", url, em: "2026-10-09" });

const LINKEDIN = conferido("https://www.linkedin.com/help/linkedin/answer/14");
const GLASSDOOR_LOGO = conferido("https://help.glassdoor.com/s/article/Add-or-update-your-logo?language=en_US");
const GLASSDOOR_CAPA = conferido("https://help.glassdoor.com/s/article/Upload-a-cover-photo-or-cover-video?language=en_US");
const GUPY = conferido("https://suporte.gupy.io/s/suporte/article/Como-criar-e-configurar-sua-pagina-de-carreira-na-Gupy?language=pt_BR");
const VIVA = conferido("https://support.microsoft.com/en-us/viva/engage/manage-a-community-in-viva-engage");
const WORKSPACE = conferido("https://support.google.com/a/answer/96474");

export const ITENS_DO_KIT: readonly ItemDoKit[] = [
  // ─── Site ────────────────────────────────────────────────────────────────
  { grupo: "site", arquivo: "favicon-16.png", nome: "Favicon 16", largura: 16, altura: 16, formato: "quadrado", desenho: "pequeno", ico: true, fonte: ESPEC },
  { grupo: "site", arquivo: "favicon-32.png", nome: "Favicon 32", largura: 32, altura: 32, formato: "quadrado", desenho: "pequeno", ico: true, fonte: ESPEC },
  { grupo: "site", arquivo: "favicon-48.png", nome: "Favicon 48", largura: 48, altura: 48, formato: "quadrado", desenho: "pequeno", ico: true, fonte: ESPEC },
  { grupo: "site", arquivo: "apple-touch-icon.png", nome: "Ícone do iPhone", largura: 180, altura: 180, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
  { grupo: "site", arquivo: "android-192.png", nome: "Ícone Android", largura: 192, altura: 192, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
  { grupo: "site", arquivo: "android-512.png", nome: "Ícone Android grande", largura: 512, altura: 512, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
  { grupo: "site", arquivo: "android-adaptavel-512.png", nome: "Ícone adaptável (Android)", largura: 512, altura: 512, formato: "quadrado", desenho: "pequeno", circuloSeguro: 0.8, obs: "o desenho dentro da área segura", fonte: ESPEC },
  { grupo: "site", arquivo: "compartilhamento-1200x630.png", nome: "Imagem de link", largura: 1200, altura: 630, formato: "faixa", desenho: "logo", obs: "WhatsApp, LinkedIn, e-mail", fonte: ESPEC },

  // ─── Redes sociais ───────────────────────────────────────────────────────
  { grupo: "redes", arquivo: "instagram-perfil-1080.png", nome: "Instagram · perfil", largura: 1080, altura: 1080, formato: "circulo", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "facebook-perfil-720.png", nome: "Facebook · perfil", largura: 720, altura: 720, formato: "circulo", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "facebook-capa-1640x624.png", nome: "Facebook · capa", largura: 1640, altura: 624, formato: "faixa", desenho: "logo", fonte: ESPEC },
  { grupo: "redes", arquivo: "linkedin-logo-400.png", nome: "LinkedIn · logo da página", largura: 400, altura: 400, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "linkedin-capa-1128x191.png", nome: "LinkedIn · capa da página", largura: 1128, altura: 191, formato: "faixa", desenho: "logo", fonte: ESPEC },
  { grupo: "redes", arquivo: "x-perfil-400.png", nome: "X · perfil", largura: 400, altura: 400, formato: "circulo", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "x-capa-1500x500.png", nome: "X · capa", largura: 1500, altura: 500, formato: "faixa", desenho: "logo", fonte: ESPEC },
  { grupo: "redes", arquivo: "youtube-perfil-800.png", nome: "YouTube · perfil", largura: 800, altura: 800, formato: "circulo", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "youtube-banner-2560x1440.png", nome: "YouTube · banner", largura: 2560, altura: 1440, formato: "faixa", desenho: "logo", seguro: { largura: 1546 / 2560, altura: 423 / 1440 }, obs: "a marca na área que aparece em todo aparelho", fonte: ESPEC },
  { grupo: "redes", arquivo: "tiktok-perfil-720.png", nome: "TikTok · perfil", largura: 720, altura: 720, formato: "circulo", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "whatsapp-business-640.png", nome: "WhatsApp Business · perfil", largura: 640, altura: 640, formato: "circulo", desenho: "pequeno", fonte: ESPEC },
  { grupo: "redes", arquivo: "pinterest-perfil-600.png", nome: "Pinterest · perfil", largura: 600, altura: 600, formato: "circulo", desenho: "pequeno", fonte: ESPEC },

  // ─── Endomarketing e employer branding ───────────────────────────────────
  { grupo: "endomarketing", arquivo: "linkedin-vitrine-capa-1128x191.png", nome: "LinkedIn · página vitrine", largura: 1128, altura: 191, formato: "faixa", desenho: "logo", fonte: ESPEC },
  { grupo: "endomarketing", arquivo: "linkedin-evento-capa-1776x444.png", nome: "LinkedIn · capa de evento", largura: 1776, altura: 444, formato: "faixa", desenho: "logo", fonte: LINKEDIN },
  { grupo: "endomarketing", arquivo: "gupy-carreiras-760x430.png", nome: "Gupy · imagem da página de carreiras", largura: 760, altura: 430, formato: "faixa", desenho: "logo", obs: "a Gupy recomenda foto do ambiente; esta é a versão com a marca", fonte: GUPY },
  { grupo: "endomarketing", arquivo: "gupy-vaga-topo-1980x600.png", nome: "Gupy · topo da página de vaga", largura: 1980, altura: 600, formato: "faixa", desenho: "logo", fonte: GUPY },
  { grupo: "endomarketing", arquivo: "glassdoor-logo-512.png", nome: "Glassdoor · logo", largura: 512, altura: 512, formato: "quadrado", desenho: "pequeno", obs: "mínimo pedido: 256 × 256", fonte: GLASSDOOR_LOGO },
  { grupo: "endomarketing", arquivo: "glassdoor-capa-2880x550.png", nome: "Glassdoor · capa", largura: 2880, altura: 550, formato: "faixa", desenho: "logo", obs: "o dobro do mínimo de 1440 × 275", fonte: GLASSDOOR_CAPA },
  { grupo: "endomarketing", arquivo: "viva-engage-capa-1400x524.png", nome: "Viva Engage · capa da comunidade", largura: 1400, altura: 524, formato: "faixa", desenho: "logo", fonte: VIVA },
  { grupo: "endomarketing", arquivo: "teams-equipe-240.png", nome: "Teams · ícone de equipe", largura: 240, altura: 240, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
  { grupo: "endomarketing", arquivo: "slack-espaco-512.png", nome: "Slack · ícone do espaço", largura: 512, altura: 512, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
  { grupo: "endomarketing", arquivo: "google-workspace-logo-320x132.png", nome: "Google Workspace · logo", largura: 320, altura: 132, formato: "faixa", desenho: "logo", obs: "exibido em exatamente 320 × 132", fonte: WORKSPACE },
  { grupo: "endomarketing", arquivo: "fundo-videochamada-1920x1080.png", nome: "Fundo de videochamada", largura: 1920, altura: 1080, formato: "videochamada", desenho: "logo", obs: "Teams, Zoom e Meet", fonte: ESPEC },
  { grupo: "endomarketing", arquivo: "papel-de-parede-1920x1080.png", nome: "Papel de parede", largura: 1920, altura: 1080, formato: "faixa", desenho: "logo", seguro: { largura: 0.5, altura: 0.5 }, fonte: ESPEC },
  { grupo: "endomarketing", arquivo: "papel-de-parede-2560x1440.png", nome: "Papel de parede (tela grande)", largura: 2560, altura: 1440, formato: "faixa", desenho: "logo", seguro: { largura: 0.5, altura: 0.5 }, fonte: ESPEC },

  // ─── E-mail ──────────────────────────────────────────────────────────────
  { grupo: "email", arquivo: "assinatura-logo-600.png", nome: "Logo da assinatura", largura: 600, altura: 0, formato: "transparente", desenho: "logo", obs: "o dobro do tamanho exibido (300 px)", fonte: ESPEC },

  // ─── Apresentação e uso geral ────────────────────────────────────────────
  { grupo: "apresentacao", arquivo: "logotipo-2000.png", nome: "Logotipo", largura: 2000, altura: 0, formato: "transparente", desenho: "logo", tom: "original", fonte: ESPEC },
  { grupo: "apresentacao", arquivo: "logotipo-negativo-2000.png", nome: "Logotipo · fundo escuro", largura: 2000, altura: 0, formato: "transparente", desenho: "logo", tom: "negativo", fonte: ESPEC },
  { grupo: "apresentacao", arquivo: "logotipo-uma-cor-2000.png", nome: "Logotipo · uma cor", largura: 2000, altura: 0, formato: "transparente", desenho: "logo", tom: "uma-cor", fonte: ESPEC },
  { grupo: "apresentacao", arquivo: "simbolo-2000.png", nome: "Símbolo", largura: 2000, altura: 0, formato: "transparente", desenho: "simbolo", tom: "original", fonte: ESPEC },
  { grupo: "apresentacao", arquivo: "avatar-512.png", nome: "Avatar (Slack, Teams, Google)", largura: 512, altura: 512, formato: "quadrado", desenho: "pequeno", fonte: ESPEC },
];

export const GRUPOS_DO_KIT: readonly { id: Grupo; nome: string; pasta: string }[] = [
  { id: "site", nome: "Site", pasta: "site" },
  { id: "redes", nome: "Redes sociais", pasta: "redes" },
  { id: "endomarketing", nome: "Endomarketing e employer branding", pasta: "endomarketing" },
  { id: "email", nome: "E-mail", pasta: "email" },
  { id: "apresentacao", nome: "Apresentação", pasta: "apresentacao" },
];

export function pastaDoGrupo(grupo: Grupo): string {
  return GRUPOS_DO_KIT.find((g) => g.id === grupo)!.pasta;
}
