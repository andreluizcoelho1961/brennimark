import assert from "node:assert/strict";
import test from "node:test";
import { formatoPorId } from "./formatos";
import { PT_POR_MM, calcularGrid, escolhasPadrao } from "./calcular";
import { aplicarRegras, deLinhaDaRegraDeGrid, fraseDaOrigem, instrucoesDoGrid, lerRegrasDeGridDaIA, paginasDoGrid, regraDasEscolhas, type RegraDeGrid } from "./regras";
import { cantoPadrao, coresParaODocumento, estilosDoFormato, fonteDoUso, larguraPadraoDoLogo, leiaMeDoGrid, lerCmyk, linhasDosEstilos, margensComProtecao, posicionarLogo, type FonteParaOGrid } from "./marca";
import { arquivosDoIdml } from "./idml";
import { montarPdf } from "./pdf";
import { unzlibSync } from "fflate";

const regra = (p: Partial<RegraDeGrid>): RegraDeGrid => ({
  id: "r", formato: "a4", tipo: "colunas", unidade: "mm", colunas: null, linhas: null, medianiz: null,
  margemSup: null, margemInf: null, margemEsq: null, margemDir: null, linhaDeBase: null, zonas: null,
  descricao: "", pagina: null, origem: "ia", status: "draft", ...p,
});

test("a ordem: regra do formato > regra geral > proposta do Brennimark", () => {
  const a4 = formatoPorId("a4");
  assert.equal(aplicarRegras(a4, []).origem.tipo, "proposta");
  const geral = regra({ formato: "todos", unidade: "proporcao", tipo: "modular", colunas: 6, margemSup: 0.1, margemEsq: 0.05 });
  const g = aplicarRegras(a4, [geral]);
  assert.equal(g.escolhas.tipo, "modular");
  assert.equal(g.escolhas.colunas, 6);
  assert.equal(g.escolhas.margens.sup, 21, "10% do lado menor (210 mm)");
  assert.equal(g.escolhas.margens.esq, 10.5);
  assert.equal(g.escolhas.margens.inf, escolhasPadrao(a4).margens.inf, "o que a regra não define fica com a proposta");
  assert.deepEqual(g.origem.tipo === "regra" && g.origem.geral, true);
  const doFormato = regra({ formato: "a4", colunas: 8, margemSup: 20 });
  const f = aplicarRegras(a4, [geral, doFormato]);
  assert.equal(f.escolhas.colunas, 8);
  assert.equal(f.escolhas.margens.sup, 20);
  assert.equal(f.escolhas.tipo, "colunas", "a regra do formato vence a geral inteira");
});

test("a frase da origem diz página e situação, nunca esconde rascunho", () => {
  assert.match(fraseDaOrigem({ tipo: "proposta" }), /proposta do Brennimark/);
  assert.equal(fraseDaOrigem({ tipo: "regra", geral: false, regra: regra({ pagina: 31, status: "ready" }) }), "do manual, p. 31 — aprovada");
  assert.match(fraseDaOrigem({ tipo: "regra", geral: true, regra: regra({ pagina: 31 }) }), /regra geral da marca.*lida pela IA, ainda não confirmada/);
  assert.match(fraseDaOrigem({ tipo: "regra", geral: false, regra: regra({ origem: "pessoa" }) }), /informada por quem edita.*ainda não aprovada/);
});

test("a linha do banco vira regra; tipo ou unidade desconhecidos não", () => {
  const r = deLinhaDaRegraDeGrid({ id: "x", formato: "a4", tipo: "modular", unidade: "mm", colunas: 6, margem_sup: "12.5", zonas: [1, "3"], descricao: "d", pagina: 4, origem: "ia", status: "ready" })!;
  assert.equal(r.margemSup, 12.5);
  assert.deepEqual(r.zonas, [1, 3]);
  assert.equal(deLinhaDaRegraDeGrid({ id: "x", formato: "a4", tipo: "radial", unidade: "mm" }), null);
});

test("as escolhas viram a regra do PATCH com os campos certos por tipo", () => {
  const f = formatoPorId("post-4x5");
  const r = regraDasEscolhas(f, { ...escolhasPadrao(f), tipo: "hierarquico", zonas: [1, 2] }, { descricao: "x", pagina: 3 });
  assert.equal(r.unidade, "px");
  assert.equal(r.linhas, null, "linhas só no modular");
  assert.deepEqual(r.zonas, [1, 2]);
  assert.equal(r.pagina, 3);
});

test("a leitura da IA: só formato conhecido, tipo da lista, valor na faixa, página enviada", () => {
  const texto = [
    'aqui está:',
    '{"formato":"todos","tipo":"modular","colunas":12,"margem_sup":0.08,"medianiz":0.02,"zonas":[1,3],"descricao":"12 colunas","pagina":31}',
    '{"formato":"a4","tipo":"colunas","colunas":99,"margem_sup":15,"pagina":32}',
    '{"formato":"inventado","tipo":"colunas","colunas":6,"pagina":31}',
    '{"formato":"post-4x5","tipo":"radial","colunas":6,"pagina":31}',
    '{"formato":"stories","tipo":"colunas","colunas":4,"pagina":99}',
    '{"formato":"todos","tipo":"colunas","colunas":3,"pagina":31}',
    '{"formato":"todos-de-novo","tipo":"colunas"',
    '{"formato":"slide-16x9","tipo":"colunas","margem_sup":20000,"pagina":32}',
  ].join("\n");
  const lidas = lerRegrasDeGridDaIA(texto, [31, 32]);
  assert.deepEqual(lidas.map((l) => l.formato), ["todos", "a4"]);
  assert.equal(lidas[0].unidade, "proporcao");
  assert.deepEqual(lidas[0].zonas, [1, 3]);
  assert.equal(lidas[1].colunas, undefined, "99 colunas é descartado; a margem fica");
  assert.equal(lidas[1].margem_sup, 15);
});

test("as páginas do grid: os trechos que falam de grid e diagramação", () => {
  const t = (p: number, c: string) => ({ pageStart: p, origem: "manual", section: null, content: c }) as never;
  assert.deepEqual(paginasDoGrid([t(5, "Cores da marca"), t(31, "Grid de 12 colunas e margens"), t(40, "A malha de diagramação")]), [31, 40]);
});

test("o logo: um quarto da área útil, no canto, com a área de proteção; avisa quando a margem corta a proteção", () => {
  const g = calcularGrid(formatoPorId("a4"), escolhasPadrao(formatoPorId("a4")));
  const w = larguraPadraoDoLogo(g);
  const [a] = g.colunas.faixas[0];
  const [, b] = g.colunas.faixas[2];
  assert.equal(w, b - a, "3 de 12 colunas");
  const r = posicionarLogo(g, { largura: w, aspecto: 0.3, canto: "inf-dir", protecao: 0.25, reducaoMinimaPx: null });
  assert.equal(r.quadro.x + r.quadro.w, g.largura - g.margens.dir);
  assert.equal(r.quadro.y + r.quadro.h, g.altura - g.margens.inf);
  assert.equal(r.protecao!.w, r.quadro.w + 2 * 0.25 * r.quadro.h);
  assert.equal(r.margemNecessaria, null);
  const apertado = posicionarLogo(g, { largura: w, aspecto: 0.3, canto: "sup-esq", protecao: 2, reducaoMinimaPx: null });
  assert.ok(apertado.margemNecessaria! > g.margens.sup);
  assert.match(apertado.avisos[0], /margem é menor que a área de proteção/);
  const m = margensComProtecao(escolhasPadrao(formatoPorId("a4")), formatoPorId("a4"), "sup-esq", apertado.margemNecessaria!);
  assert.ok(m.sup * PT_POR_MM >= apertado.margemNecessaria! - 0.01 && m.esq * PT_POR_MM >= apertado.margemNecessaria! - 0.01);
  const post = calcularGrid(formatoPorId("post-4x5"), escolhasPadrao(formatoPorId("post-4x5")));
  const pequeno = posicionarLogo(post, { largura: 50, aspecto: 0.3, canto: "inf-esq", protecao: 0, reducaoMinimaPx: 120 });
  assert.equal(pequeno.quadro.w, 120, "nunca abaixo da redução mínima nos digitais");
});

test("o CMYK como os manuais escrevem", () => {
  for (const t of ["0 85 100 0", "C0 M85 Y100 K0", "c:0 m:85 y:100 k:0", "0/85/100/0", "0%, 85%, 100%, 0%", "C 0 · M 85 · Y 100 · K 0"]) {
    assert.deepEqual(lerCmyk(t), [0, 85, 100, 0], t);
  }
  assert.equal(lerCmyk("Pantone 485 C"), null);
  assert.equal(lerCmyk("0 85 100"), null);
  assert.equal(lerCmyk("0 185 100 0"), null);
});

test("as cores: CMYK do manual no impresso, RGB no digital, e o que ficou de fora é dito", () => {
  const paleta = [
    { nome: "Vermelho", hex: "#CC092F", cmyk: "0 100 80 0", pagina: 10 },
    { nome: "Cinza", hex: "#666666", cmyk: null, pagina: null },
    { nome: "Sem hex", hex: null, cmyk: "0 0 0 50", pagina: null },
  ];
  const imp = coresParaODocumento(paleta, true);
  assert.deepEqual(imp.cores.map((c) => [c.nome, c.cmyk]), [["Vermelho — manual, p. 10", [0, 100, 80, 0]], ["Cinza", null]]);
  assert.equal(imp.notas.length, 2);
  const dig = coresParaODocumento(paleta, false);
  assert.deepEqual(dig.cores[0].rgb, [204, 9, 47]);
  assert.equal(dig.cores[0].cmyk, null);
});

test("os estilos: entrelinha sempre múltiplo da linha de base e maior que o corpo; corpo da tabela", () => {
  const a4 = formatoPorId("a4");
  const es = estilosDoFormato(a4, escolhasPadrao(a4));
  assert.deepEqual(es.map((e) => e.nome), ["Título", "Subtítulo", "Texto", "Legenda"]);
  assert.deepEqual(es.find((e) => e.nome === "Texto"), { nome: "Texto", corpo: 9.5, entrelinha: 12, fonte: null });
  const post = formatoPorId("post-4x5");
  const ep = estilosDoFormato(post, escolhasPadrao(post));
  assert.deepEqual(ep.find((e) => e.nome === "Título"), { nome: "Título", corpo: 96, entrelinha: 108, fonte: null }, "da tabela aprovada");
  assert.deepEqual(ep.find((e) => e.nome === "Texto"), { nome: "Texto", corpo: 32, entrelinha: 36, fonte: null }, "achado no InDesign: era 32/12");
  for (const f of [a4, post, formatoPorId("slide-16x9"), formatoPorId("cartaz-50x70"), formatoPorId("iab-728x90")]) {
    const e = escolhasPadrao(f);
    for (const s of estilosDoFormato(f, e)) {
      assert.ok(s.entrelinha >= s.corpo, `${f.id} ${s.nome}: entrelinha menor que o corpo`);
      assert.ok(Math.abs(s.entrelinha / e.linhaDeBase - Math.round(s.entrelinha / e.linhaDeBase)) < 1e-9, `${f.id} ${s.nome}: fora da linha de base`);
    }
  }
});

test("o IDML da marca: logo colocado como o InDesign escreve, proteção que não imprime, cores e estilos", () => {
  const f = formatoPorId("a4");
  const g = calcularGrid(f, escolhasPadrao(f));
  const x = arquivosDoIdml(g, {
    origemDoGrid: "do manual, p. 31 — aprovada",
    logo: { arquivo: "logo.ai", formato: "pdf", limites: { esq: 80, sup: 700, dir: 280, inf: 750 }, quadro: { x: 48, y: 700, w: 100, h: 25 }, protecao: { x: 40, y: 692, w: 116, h: 41 } },
    cores: [{ nome: "Vermelho — manual, p. 10", cmyk: [0, 100, 80, 0], rgb: [204, 9, 47] }],
    estilos: [{ nome: "Texto", corpo: 9.5, entrelinha: 12 }],
  });
  const sp = x["Spreads/Spread_sp1.xml"];
  assert.match(sp, /<PDF Self="gr_logo" ItemTransform="0\.5 0 0 0\.5 8 /);
  assert.match(sp, /PDFCrop="CropArt"/);
  assert.match(sp, /<GraphicBounds Left="80" Top="700" Right="280" Bottom="750"\/>/);
  assert.match(sp, /LinkResourceURI="file:Links\/logo\.ai"/);
  assert.match(sp, /Name="Área de proteção do logo"[^>]*Nonprinting="true"/);
  assert.match(x["Resources/Graphic.xml"], /Space="CMYK" ColorValue="0 100 80 0" Name="Vermelho — manual, p\. 10"/);
  assert.match(x["Resources/Styles.xml"], /Name="Texto" Imported="false" PointSize="9\.5" AlignToBaseline="true"/);
  assert.match(x["designmap.xml"], /Name="Grid — do manual, p\. 31 — aprovada"/);
  assert.match(x["designmap.xml"], /Name="Logo — área de proteção do manual"[^>]*Printable="true"/);
  assert.doesNotMatch(arquivosDoIdml(g)["designmap.xml"], /ly_logo/, "a versão grátis não muda");
});

test("o LEIA-ME diz de onde veio cada coisa e o que falta", () => {
  const t = leiaMeDoGrid({ marca: "Bradesco", formato: formatoPorId("a4"), origemDoGrid: "proposta do Brennimark", tipo: "colunas", logo: null, cores: [], notasDasCores: [], avisos: ["x"] });
  assert.match(t, /GRID \(colunas\): proposta do Brennimark/);
  assert.match(t, /não tem logotipo/);
  assert.match(t, /ainda não tem cores aprovadas/);
  assert.match(t, /tipografia da marca/);
  assert.match(t, /AVISOS:\n  · x/);
});

// ─── A tipografia da marca nos estilos (14/10/2026) ─────────────────────────

const fonte = (p: Partial<FonteParaOGrid>): FonteParaOGrid => ({
  uso: "texto", segmento: "", familia: "Inter", estilo: "", espacejamento: null, caixaAlta: null, pagina: 30, ...p,
});

test("a fonte de cada uso: a do meio quando o manual separa, senão a sem segmento", () => {
  const fontes = [
    fonte({ uso: "texto", familia: "Geral" }),
    fonte({ uso: "texto", segmento: "Digital", familia: "Tela" }),
    fonte({ uso: "texto", segmento: "Impresso", familia: "Papel" }),
    fonte({ uso: "titulo", segmento: "digital", familia: "Só digital" }),
  ];
  assert.equal(fonteDoUso(fontes, "texto", true)?.familia, "Papel");
  assert.equal(fonteDoUso(fontes, "texto", false)?.familia, "Tela");
  assert.equal(fonteDoUso(fontes, "titulo", true)?.familia, "Só digital", "sem a do meio nem a geral, a que houver");
  assert.equal(fonteDoUso(fontes, "legenda", true), null);
});

test("os estilos levam a fonte aprovada; o corpo continua o do grid; herança dita como proposta", () => {
  const a4 = formatoPorId("a4");
  const sem = estilosDoFormato(a4, escolhasPadrao(a4));
  const fontes = [
    fonte({ uso: "titulo", familia: "Inter", estilo: "Bold", espacejamento: -10 }),
    fonte({ uso: "texto", familia: "Inter", estilo: "Regular" }),
    fonte({ uso: "destaque", familia: "Inter", estilo: "Black", caixaAlta: true, pagina: 31 }),
  ];
  const es = estilosDoFormato(a4, escolhasPadrao(a4), fontes);
  assert.deepEqual(es.map((e) => e.nome), ["Título", "Subtítulo", "Texto", "Legenda", "Destaque"], "Apoio só quando a marca define");
  assert.deepEqual(es.slice(0, 4).map((e) => [e.corpo, e.entrelinha]), sem.map((e) => [e.corpo, e.entrelinha]), "o tamanho é do grid");
  assert.equal(es[0].fonte?.familia, "Inter");
  assert.equal(es[0].fonte?.estilo, "Bold");
  assert.equal(es[0].fonte?.origem, "manual, p. 30 — aprovada");
  assert.match(es[1].fonte!.origem, /usa a do Título \(proposta do Brennimark\)/);
  assert.equal(es[1].fonte?.estilo, "Bold");
  assert.match(es[3].fonte!.origem, /usa a do Texto/);
  assert.equal(es[4].fonte?.caixaAlta, true);
  const linhas = linhasDosEstilos(es);
  assert.equal(linhas[0], "Título (31/36): Inter Bold, espacejamento -10 — manual, p. 30 — aprovada.");
  assert.match(linhasDosEstilos(sem)[0], /sem fonte da marca aprovada/);
});

test("o IDML: a fonte entra no estilo de parágrafo como o InDesign escreve", () => {
  const f = formatoPorId("a4");
  const g = calcularGrid(f, escolhasPadrao(f));
  const estilos = estilosDoFormato(f, escolhasPadrao(f), [
    fonte({ uso: "titulo", familia: "Bradesco Sans & Co", estilo: "Bold", espacejamento: -10, caixaAlta: true }),
  ]);
  const x = arquivosDoIdml(g, { origemDoGrid: "proposta", logo: null, cores: [], estilos });
  const st = x["Resources/Styles.xml"];
  assert.match(st, /Name="Título" Imported="false" PointSize="31" FontStyle="Bold" Tracking="-10" Capitalization="AllCaps" AlignToBaseline="true"><Properties><BasedOn type="string">\$ID\/NormalParagraphStyle<\/BasedOn><AppliedFont type="string">Bradesco Sans &amp; Co<\/AppliedFont><Leading/);
  // Texto sem fonte aprovada: nenhum AppliedFont, fica a padrão.
  assert.match(st, /Name="Texto" Imported="false" PointSize="9.5" AlignToBaseline="true"><Properties><BasedOn type="string">\$ID\/NormalParagraphStyle<\/BasedOn><Leading/);
});

test("o LEIA-ME diz quais fontes instalar e quantas ficaram em rascunho", () => {
  const f = formatoPorId("a4");
  const estilos = estilosDoFormato(f, escolhasPadrao(f), [fonte({ uso: "titulo", familia: "Inter", estilo: "Bold" }), fonte({ uso: "texto", familia: "Inter", estilo: "Regular" })]);
  const base = { marca: "Bancada", formato: f, origemDoGrid: "proposta", tipo: "colunas", logo: null, cores: [], notasDasCores: [], avisos: [] };
  const com = leiaMeDoGrid({ ...base, estilos, fontesEmRascunho: 2 });
  assert.match(com, /INSTALE AS FONTES antes de abrir: Inter Bold; Inter Regular\./);
  assert.match(com, /2 fontes em rascunho não entraram/);
  assert.match(com, /Subtítulo \(.*\): Inter Bold — o manual não define; usa a do Título/);
  const sem = leiaMeDoGrid({ ...base, estilos: estilosDoFormato(f, escolhasPadrao(f)) });
  assert.match(sem, /ainda não tem fonte aprovada/);
  assert.doesNotMatch(sem, /INSTALE/);
});

test("o logo nasce embaixo à direita; onde o LinkedIn manda evitar esse canto, em cima à esquerda", () => {
  assert.equal(cantoPadrao(formatoPorId("a4")), "inf-dir");
  assert.equal(cantoPadrao(formatoPorId("post-4x5")), "inf-dir");
  assert.equal(cantoPadrao(formatoPorId("linkedin-capa")), "sup-esq");
  assert.equal(cantoPadrao(formatoPorId("linkedin-vitrine")), "sup-esq");
});

test("o PDF com a marca: logo como imagem com máscara, proteção, e o índice do PDF bate byte a byte", () => {
  const f = formatoPorId("post-4x5");
  const g = calcularGrid(f, escolhasPadrao(f));
  const imagem = { largura: 2, altura: 1, rgb: new Uint8Array([200, 0, 30, 255, 255, 255]), alfa: new Uint8Array([255, 0]) };
  const bytes = montarPdf(g, { logo: { quadro: { x: 800, y: 1200, w: 200, h: 100 }, protecao: { x: 765, y: 1165, w: 270, h: 170 }, imagem } });
  const latin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  assert.match(latin, /\/XObject << \/Logo 5 0 R >>/);
  assert.match(latin, /200 0 0 100 800 50 cm \/Logo Do/, "o quadro na página, y contado de baixo (1350 − 1200 − 100)");
  assert.match(latin, /\/SMask 6 0 R/);
  // Cada posição do xref aponta para o começo de "N 0 obj".
  const xref = Number(/startxref\n(\d+)/.exec(latin)![1]);
  const linhas = latin.slice(xref).split("\n").slice(3, 9);
  linhas.forEach((l, i) => assert.equal(latin.slice(Number(l.slice(0, 10)), Number(l.slice(0, 10)) + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
  // Os pixels voltam iguais.
  const inicio = latin.indexOf("stream\n", latin.indexOf("5 0 obj")) + 7;
  const tamanho = Number(/5 0 obj\n<<[^>]*\/Length (\d+)/.exec(latin)![1]);
  assert.deepEqual(Array.from(unzlibSync(bytes.slice(inicio, inicio + tamanho))), [200, 0, 30, 255, 255, 255]);
  // Sem marca, o PDF de sempre, sem imagem.
  assert.doesNotMatch(Array.from(montarPdf(g), (b) => String.fromCharCode(b)).join(""), /XObject/);
});

test("o LEIA-ME de peça digital diz que as cores vão em RGB", () => {
  const base = { marca: "Bancada", origemDoGrid: "proposta", tipo: "colunas", logo: null, notasDasCores: [], avisos: [] };
  const cores = [{ nome: "Vermelho", cmyk: null, rgb: [200, 0, 30] as [number, number, number] }];
  assert.match(leiaMeDoGrid({ ...base, formato: formatoPorId("post-4x5"), cores }), /Peça digital: amostras em RGB/);
  assert.doesNotMatch(leiaMeDoGrid({ ...base, formato: formatoPorId("a4"), cores }), /Peça digital/);
});

test("o grid da Bradesco (15/10/2026): as sete páginas de grid vão à IA, e Estrutura 3×3 vira regra modular", () => {
  const t = (pagina: number, content: string) => ({ documentSlug: "s", documentTitle: "t", groupName: "g", section: null, status: "ready", pageStart: pagina, pageEnd: pagina, content });
  const menu = "Logos Cores Tipografia Grid Materializações";
  const trechos = [
    ...[1, 4, 5, 6, 10, 17, 21].map((p) => t(p, `Página ${p} ${menu}`)),
    ...[28, 29, 30, 31, 32, 33, 34].map((p) => t(p, `Grid A Marca ${menu} ${p === 30 ? "Estrutura 3X3" : p === 31 ? "Estrutura 5X5 1/5 2/5" : "Grid horizontal"}`)),
  ];
  assert.deepEqual(paginasDoGrid(trechos), [28, 29, 30, 31, 32, 33, 34], "antes, o corte de quatro deixava a 30 e a 31 de fora");
  assert.match(instrucoesDoGrid([30, 31]), /ESTRUTURA "N×N"/);
  const [regra] = lerRegrasDeGridDaIA('{"formato": "todos", "tipo": "modular", "colunas": 3, "linhas": 3, "descricao": "Estrutura 3X3", "pagina": 30}', [30, 31]);
  assert.deepEqual({ formato: regra.formato, tipo: regra.tipo, colunas: regra.colunas, linhas: regra.linhas, unidade: regra.unidade }, { formato: "todos", tipo: "modular", colunas: 3, linhas: 3, unidade: "proporcao" });
});
