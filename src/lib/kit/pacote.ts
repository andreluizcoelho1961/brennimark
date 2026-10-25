/**
 * As partes PURAS do Brennimark Kit (09/10/2026): onde o desenho entra em cada
 * imagem, o favicon.ico, o manifest, o trecho para colar no site, a assinatura
 * de e-mail e o LEIA-ME. Testadas sem navegador; o desenho em canvas e o ZIP
 * são `desenhar-no-navegador.ts`.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import { nomeDoArquivo, pastaDoGrupo, type Grupo } from "./tamanhos";
import type { Tradutor } from "../i18n/tradutor";
import type { ItemDoKit } from "./tamanhos";

export type Retangulo = { x: number; y: number; largura: number; altura: number };

/** Altura final do arquivo: a da tabela, ou a da proporção do desenho. */
export function alturaDoItem(item: Pick<ItemDoKit, "largura" | "altura">, desenho: { largura: number; altura: number }): number {
  if (item.altura > 0) return item.altura;
  return Math.max(1, Math.round((item.largura * desenho.altura) / desenho.largura));
}

/**
 * Onde o desenho entra na imagem. `margem` é a fração de respiro em cada lado
 * (0,16 = 16%), aplicada dentro da área segura quando houver. `protecao` é a
 * ÁREA DE PROTEÇÃO da marca, em fração da altura do desenho (0,25 = um quarto
 * da altura livre em volta): o que se encaixa é o desenho MAIS essa área, de
 * modo que nada da imagem encoste nela.
 *
 * - círculo: a caixa (desenho + proteção) cabe INTEIRA no círculo inscrito — a
 *   diagonal dela não passa do diâmetro útil. Nenhuma ponta é cortada;
 * - faixa: o desenho fica no máximo com metade da altura, para a capa não
 *   virar um logo gigante;
 * - videochamada: no canto de cima à direita, 16% da largura, afastado das
 *   bordas pelo maior entre o respiro padrão e a área de proteção;
 * - transparente: o desenho ocupa a imagem inteira (é o arquivo do logo).
 */
export function encaixe(
  item: Pick<ItemDoKit, "largura" | "altura" | "formato" | "seguro" | "circuloSeguro">,
  desenho: { largura: number; altura: number },
  margem: number,
  protecao = 0,
): Retangulo {
  const L = item.largura;
  const A = alturaDoItem(item, desenho);
  const proporcao = desenho.largura / desenho.altura;
  // A caixa que se encaixa: o desenho com a área de proteção, em unidades do desenho.
  const caixaL = desenho.largura + 2 * protecao * desenho.altura;
  const caixaA = desenho.altura * (1 + 2 * protecao);
  const proporcaoDaCaixa = caixaL / caixaA;
  const centrado = (w: number) => {
    const h = w / proporcao;
    return { x: (L - w) / 2, y: (A - h) / 2, largura: w, altura: h };
  };
  /** Largura do desenho quando a caixa tem esta largura. */
  const desenhoNaCaixa = (larguraDaCaixa: number) => larguraDaCaixa * (desenho.largura / caixaL);

  if (item.formato === "transparente") return { x: 0, y: 0, largura: L, altura: A };

  if (item.formato === "videochamada") {
    const w = L * 0.16;
    const h = w / proporcao;
    const afastamento = protecao * h;
    return { x: L - w - Math.max(L * 0.04, afastamento), y: Math.max(L * 0.035, afastamento), largura: w, altura: h };
  }

  const circulo = item.formato === "circulo" ? 1 : item.circuloSeguro;
  if (circulo) {
    // diâmetro útil; a diagonal da caixa (c·√(1 + 1/p²)) cabe nele
    const diametro = Math.min(L, A) * circulo * (1 - 2 * margem);
    const larguraDaCaixa = diametro / Math.sqrt(1 + 1 / (proporcaoDaCaixa * proporcaoDaCaixa));
    return centrado(desenhoNaCaixa(larguraDaCaixa));
  }

  const areaL = L * (item.seguro?.largura ?? 1) * (1 - 2 * margem);
  const areaA = A * (item.seguro?.altura ?? 1) * (1 - 2 * margem);
  let w = desenhoNaCaixa(Math.min(areaL, areaA * proporcaoDaCaixa));
  if (item.formato === "faixa") w = Math.min(w, A * 0.5 * proporcao);
  return centrado(w);
}

export type ReducaoMinima = { logo: number | null; simbolo: number | null };

/**
 * A REDUÇÃO MÍNIMA da marca: o desenho foi parar abaixo da largura mínima?
 * Devolve a largura mínima que foi violada, ou null. Só vale para arquivos de
 * uso (ícone, perfil, capa): o arquivo transparente é o próprio logo, grande.
 */
export function abaixoDaReducao(
  item: Pick<ItemDoKit, "formato">,
  larguraDoDesenho: number,
  qual: "logo" | "simbolo",
  reducao: ReducaoMinima,
): number | null {
  if (item.formato === "transparente") return null;
  const minimo = reducao[qual];
  return minimo && larguraDoDesenho < minimo - 0.5 ? minimo : null;
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

export function manifestDoSite(nome: string, corDoFundo: string, t: Tradutor): string {
  const arq = (id: string) => `/${nomeDoArquivo({ arquivo: `${id}.png` }, t)}`;
  const icones = [
    { src: arq("android-192"), sizes: "192x192", type: "image/png" },
    { src: arq("android-512"), sizes: "512x512", type: "image/png" },
    { src: arq("android-adaptavel-512"), sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];
  return JSON.stringify(
    { name: nome, short_name: nome, icons: icones, theme_color: corDoFundo, background_color: corDoFundo, display: "standalone" },
    null,
    2,
  ) + "\n";
}

export function trechoDoHead(temSvg: boolean, t: Tradutor): string {
  return [
    t("pacote.cabecalho1"),
    t("pacote.cabecalho2"),
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    ...(temSvg ? ['<link rel="icon" href="/favicon.svg" type="image/svg+xml">'] : []),
    `<link rel="apple-touch-icon" href="/${nomeDoArquivo({ arquivo: "apple-touch-icon.png" }, t)}">`,
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta property="og:image" content="/${nomeDoArquivo({ arquivo: "compartilhamento-1200x630.png" }, t)}">`,
    "",
  ].join("\n");
}

export type DadosDaAssinatura = {
  nome: string; cargo: string; telefone: string; site: string; empresa: string;
  /**
   * A fonte da assinatura (14/10/2026): a SUBSTITUTA aprovada do uso "texto"
   * da tipografia da marca — o e-mail não carrega a fonte da marca, e a
   * substituta é a que o manual permite onde ela não roda. Sem ela, Arial.
   */
  fonte?: { nome: string; origem: string } | null;
};

/** O nome de uma fonte dentro de `font-family`: só letras, números, espaço e hífen. */
export function nomeSeguroDaFonte(nome: string): string {
  return nome.normalize("NFC").replace(/[^\p{L}\p{N} -]/gu, "").replace(/\s+/g, " ").trim().slice(0, 60);
}

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
  const fonte = d.fonte ? nomeSeguroDaFonte(d.fonte.nome) : "";
  const familias = fonte && !/^arial$/i.test(fonte) ? `'${fonte}',Arial,Helvetica,sans-serif` : "Arial,Helvetica,sans-serif";
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:${familias};font-size:13px;line-height:1.45;color:#222222">`
    + `<tr><td style="padding-right:14px;border-right:1px solid #dddddd;vertical-align:middle">`
    + `<img src="${escaparHtml(enderecoDoLogo)}" width="${larguraDoLogo}" alt="${escaparHtml(d.empresa.trim() || "Logo")}" style="display:block;border:0">`
    + `</td><td style="padding-left:14px;vertical-align:middle">`
    + `<strong style="font-size:14px">${escaparHtml(d.nome.trim())}</strong>`
    + linha(d.cargo, "color:#555555")
    + linha(d.telefone, "color:#555555")
    + linhaDoSite
    + `</td></tr></table>`;
}

/**
 * As regras aplicadas e de onde vieram. Sem `fontes`, foram informadas pela
 * pessoa (Kit gratuito); com `fontes`, vieram do manual (Kit do assinante),
 * e cada uma diz a página e se está aprovada.
 */
export type RegrasInformadas = {
  protecao: number; reducao: ReducaoMinima; abaixo: string[];
  fontes?: Partial<Record<"protecao" | "logo" | "simbolo", string>>;
  /** A fonte da assinatura e de onde veio (Kit do assinante, 14/10/2026). */
  fonteDaAssinatura?: { nome: string; origem: string } | null;
};

/** `t` é o tradutor ligado a `ferramentas.kit`: o LEIA-ME sai no idioma de quem baixa. */
export function leiaMe(nome: string, comSimbolo: boolean, comAssinatura: boolean, regras: RegrasInformadas | undefined, t: Tradutor): string {
  const informada = t("pacote.informadaPorVoce");
  /** O nome da pasta com a barra, alinhado em 14 colunas, mais 2 espaços como no LEIA-ME de sempre. */
  const pasta = (g: Grupo) => `${pastaDoGrupo(g, t)}/`.padEnd(14);
  const linhasDasRegras = !regras ? [] : [
    regras.protecao > 0 ? t("pacote.protecaoAplicada", { pct: Math.round(regras.protecao * 100), fonte: regras.fontes?.protecao ?? informada }) : "",
    regras.reducao.logo ? t("pacote.reducaoLogo", { px: regras.reducao.logo, fonte: regras.fontes?.logo ?? informada }) : "",
    regras.reducao.simbolo ? t("pacote.reducaoSimbolo", { px: regras.reducao.simbolo, fonte: regras.fontes?.simbolo ?? informada }) : "",
    ...(regras.abaixo.length ? ["", t("pacote.atencaoAbaixo"), ...regras.abaixo.map((a) => `  ${a}`)] : []),
  ];
  return [
    t("pacote.titulo", { nome: nome || t("pacote.semNome") }),
    t("pacote.tudoNoComputador"),
    "",
    t("pacote.pastaSite", { pasta: pasta("site"), colar: t("extras.coleNoSite") }),
    t("pacote.pastaRedes", { pasta: pasta("redes") }),
    t("pacote.pastaEndomarketing", { pasta: pasta("endomarketing") }),
    t("pacote.pastaEmail", { pasta: pasta("email"), assinatura: t("extras.assinatura") }),
    t("pacote.pastaApresentacao", { pasta: pasta("apresentacao") }),
    "",
    comSimbolo ? t("pacote.comSimbolo") : t("pacote.semSimbolo"),
    comAssinatura ? t("pacote.assinaturaEndereco", { arquivo: nomeDoArquivo({ arquivo: "assinatura-logo-600.png" }, t) }) : "",
    comAssinatura && regras?.fonteDaAssinatura
      ? t("pacote.assinaturaFonte", { nome: regras.fonteDaAssinatura.nome, origem: regras.fonteDaAssinatura.origem })
      : "",
    "",
    ...linhasDasRegras,
    "",
    regras?.fontes ? "" : t("pacote.noBrennimark"),
    "",
  ].filter((l, i, todas) => l !== "" || todas[i - 1] !== "").join("\n");
}

/** Avisos sobre o arquivo enviado: o que vai sair borrado, antes de baixar. */
/** `t` é o tradutor ligado a `ferramentas.arquivos`. */
export function avisosDoArquivo(arquivo: { tipo: string; largura: number; altura: number }, t: Tradutor): string[] {
  const avisos: string[] = [];
  if (arquivo.tipo === "image/jpeg") avisos.push(t("aviso.jpg"));
  if (arquivo.tipo !== "image/svg+xml" && Math.max(arquivo.largura, arquivo.altura) < 1024) {
    avisos.push(t("aviso.pequena", { largura: arquivo.largura, altura: arquivo.altura }));
  }
  return avisos;
}
