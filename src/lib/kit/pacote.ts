/**
 * As partes PURAS do Brennimark Kit (09/10/2026): onde o desenho entra em cada
 * imagem, o favicon.ico, o manifest, o trecho para colar no site, a assinatura
 * de e-mail e o LEIA-ME. Testadas sem navegador; o desenho em canvas e o ZIP
 * são `desenhar-no-navegador.ts`.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import type { ItemDoKit } from "./tamanhos";

export type Retangulo = { x: number; y: number; largura: number; altura: number };

/** Altura final do arquivo: a da tabela, ou a da proporção do desenho. */
export function alturaDoItem(item: Pick<ItemDoKit, "largura" | "altura">, desenho: { largura: number; altura: number }): number {
  if (item.altura > 0) return item.altura;
  return Math.max(1, Math.round((item.largura * desenho.altura) / desenho.largura));
}

/**
 * Onde o desenho entra na imagem. `margem` é a fração de respiro em cada lado
 * (0,16 = 16%), aplicada dentro da área segura quando houver.
 *
 * - círculo: o retângulo do desenho cabe INTEIRO no círculo inscrito — a
 *   diagonal dele não passa do diâmetro útil. Assim nenhuma ponta é cortada
 *   pelo recorte da rede;
 * - faixa: no máximo metade da altura, para a capa não virar um logo gigante;
 * - videochamada: no canto de cima à direita, 16% da largura; o centro fica
 *   livre para o rosto;
 * - transparente: o desenho ocupa a imagem inteira (ela já tem a proporção dele).
 */
export function encaixe(
  item: Pick<ItemDoKit, "largura" | "altura" | "formato" | "seguro" | "circuloSeguro">,
  desenho: { largura: number; altura: number },
  margem: number,
): Retangulo {
  const L = item.largura;
  const A = alturaDoItem(item, desenho);
  const proporcao = desenho.largura / desenho.altura;
  const centrado = (w: number) => {
    const h = w / proporcao;
    return { x: (L - w) / 2, y: (A - h) / 2, largura: w, altura: h };
  };

  if (item.formato === "transparente") return { x: 0, y: 0, largura: L, altura: A };

  if (item.formato === "videochamada") {
    const w = L * 0.16;
    const h = w / proporcao;
    return { x: L - w - L * 0.04, y: L * 0.035, largura: w, altura: h };
  }

  const circulo = item.formato === "circulo" ? 1 : item.circuloSeguro;
  if (circulo) {
    // diâmetro útil; a diagonal do desenho (w·√(1 + 1/p²)) cabe nele
    const diametro = Math.min(L, A) * circulo * (1 - 2 * margem);
    const w = diametro / Math.sqrt(1 + 1 / (proporcao * proporcao));
    return centrado(w);
  }

  const areaL = L * (item.seguro?.largura ?? 1) * (1 - 2 * margem);
  const areaA = A * (item.seguro?.altura ?? 1) * (1 - 2 * margem);
  let w = Math.min(areaL, areaA * proporcao);
  if (item.formato === "faixa") w = Math.min(w, A * 0.5 * proporcao);
  return centrado(w);
}

/** Um .ico com PNGs dentro (o formato que todo navegador aceita desde o Vista). */
export function favicoIco(pngs: readonly { tamanho: number; bytes: Uint8Array }[]): Uint8Array {
  const cabecalho = 6 + 16 * pngs.length;
  const total = cabecalho + pngs.reduce((s, p) => s + p.bytes.byteLength, 0);
  const saida = new Uint8Array(total);
  const v = new DataView(saida.buffer);
  v.setUint16(0, 0, true);
  v.setUint16(2, 1, true); // tipo: ícone
  v.setUint16(4, pngs.length, true);
  let deslocamento = cabecalho;
  pngs.forEach((p, i) => {
    const b = 6 + 16 * i;
    v.setUint8(b, p.tamanho >= 256 ? 0 : p.tamanho);
    v.setUint8(b + 1, p.tamanho >= 256 ? 0 : p.tamanho);
    v.setUint16(b + 4, 1, true); // planos
    v.setUint16(b + 6, 32, true); // bits por pixel
    v.setUint32(b + 8, p.bytes.byteLength, true);
    v.setUint32(b + 12, deslocamento, true);
    saida.set(p.bytes, deslocamento);
    deslocamento += p.bytes.byteLength;
  });
  return saida;
}

export function manifestDoSite(nome: string, corDoFundo: string): string {
  const icones = [
    { src: "/android-192.png", sizes: "192x192", type: "image/png" },
    { src: "/android-512.png", sizes: "512x512", type: "image/png" },
    { src: "/android-adaptavel-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];
  return JSON.stringify(
    { name: nome, short_name: nome, icons: icones, theme_color: corDoFundo, background_color: corDoFundo, display: "standalone" },
    null,
    2,
  ) + "\n";
}

export function trechoDoHead(temSvg: boolean): string {
  return [
    "<!-- Cole dentro do <head> de todas as páginas do site. Os arquivos da pasta",
    "     site/ vão na raiz do site (o mesmo lugar do index.html). -->",
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    ...(temSvg ? ['<link rel="icon" href="/favicon.svg" type="image/svg+xml">'] : []),
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    '<meta property="og:image" content="/compartilhamento-1200x630.png">',
    "",
  ].join("\n");
}

export type DadosDaAssinatura = { nome: string; cargo: string; telefone: string; site: string; empresa: string };

/** Texto que vai para dentro do HTML da assinatura: nada de marcação colada. */
export function escaparHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** O site vira link só se parecer um endereço; nunca `javascript:` nem afins. */
export function enderecoDoSite(site: string): string | null {
  const limpo = site.trim().replace(/^https?:\/\//i, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}(\/[\w\-./?=&%#]*)?$/i.test(limpo)) return null;
  return `https://${limpo}`;
}

/**
 * A assinatura de e-mail em HTML de tabela — o único que Gmail, Outlook e Apple
 * Mail mostram igual. Cores neutras (o e-mail não é moldura da marca: é dela,
 * mas a cor certa depende do manual, que o modo avulso não lê).
 */
export function assinaturaHtml(d: DadosDaAssinatura, enderecoDoLogo: string, larguraDoLogo = 150): string {
  const linha = (texto: string, estilo: string) => (texto.trim() ? `<br><span style="${estilo}">${escaparHtml(texto.trim())}</span>` : "");
  const site = enderecoDoSite(d.site);
  const linhaDoSite = site
    ? `<br><a href="${escaparHtml(site)}" style="color:#222222;text-decoration:none">${escaparHtml(d.site.trim().replace(/^https?:\/\//i, ""))}</a>`
    : linha(d.site, "color:#555555");
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#222222">`
    + `<tr><td style="padding-right:14px;border-right:1px solid #dddddd;vertical-align:middle">`
    + `<img src="${escaparHtml(enderecoDoLogo)}" width="${larguraDoLogo}" alt="${escaparHtml(d.empresa.trim() || "Logo")}" style="display:block;border:0">`
    + `</td><td style="padding-left:14px;vertical-align:middle">`
    + `<strong style="font-size:14px">${escaparHtml(d.nome.trim())}</strong>`
    + linha(d.cargo, "color:#555555")
    + linha(d.telefone, "color:#555555")
    + linhaDoSite
    + `</td></tr></table>`;
}

export function leiaMe(nome: string, comSimbolo: boolean, comAssinatura: boolean): string {
  return [
    `Kit da marca ${nome || "(sem nome)"} — gerado pelo Brennimark Kit.`,
    "Tudo foi feito no seu computador; nenhum arquivo saiu dele.",
    "",
    "site/           ícones do site, imagem de link, manifest e o código para colar no <head> (COLE-NO-SITE.html).",
    "redes/          perfis e capas das redes sociais. Perfis são recortados em círculo: o desenho já cabe nele.",
    "endomarketing/  LinkedIn, Gupy, Glassdoor, Viva Engage, Teams, Slack, Google Workspace, videochamada e papel de parede.",
    "email/          logo da assinatura e a assinatura pronta (assinatura.html).",
    "apresentacao/   logotipo e símbolo em alta resolução, para fundo claro, escuro e uma cor.",
    "",
    comSimbolo
      ? "Nos tamanhos pequenos (ícones e perfis) entrou o símbolo; nos grandes, o logotipo inteiro."
      : "Sem símbolo separado, o logotipo inteiro entrou também nos tamanhos pequenos — confira se fica legível.",
    comAssinatura ? "A assinatura usa o endereço da imagem: hospede assinatura-logo-600.png no site e troque o endereço." : "",
    "",
    "Margens padrão. No Brennimark, o Kit lê o manual da sua marca e aplica a área de proteção e a redução mínima sozinho.",
    "",
  ].filter((l, i, todas) => l !== "" || todas[i - 1] !== "").join("\n");
}

/** Avisos sobre o arquivo enviado: o que vai sair borrado, antes de baixar. */
export function avisosDoArquivo(arquivo: { tipo: string; largura: number; altura: number }): string[] {
  const avisos: string[] = [];
  if (arquivo.tipo === "image/jpeg") avisos.push("JPG não tem fundo transparente: o retângulo do fundo vai aparecer em volta do logo. Se tiver, use SVG ou PNG.");
  if (arquivo.tipo !== "image/svg+xml" && Math.max(arquivo.largura, arquivo.altura) < 1024) {
    avisos.push(`A imagem tem ${arquivo.largura} × ${arquivo.altura} px. Nos tamanhos grandes (capas, banner, papel de parede) ela vai sair borrada. Se tiver, use o SVG.`);
  }
  return avisos;
}
