/**
 * O IDML do Brennimark Grids (13/10/2026) — o formato aberto do InDesign, que
 * o Affinity Publisher também abre. Montado no navegador, como o .zip do Kit.
 *
 * O XML segue o protótipo PROVADO no InDesign 2026 do André em 13/10/2026
 * (abriu sem erro; preflight "No errors"). Duas lições do protótipo:
 *   - a `Location` das guias é contada do TOPO DA PÁGINA, enquanto os objetos
 *     usam as coordenadas do spread (centro na metade da altura);
 *   - o `mimetype` vai primeiro no pacote e sem compressão.
 *
 * Cada parte do grid vai numa camada própria — o diretor de arte liga e
 * desliga no painel Camadas. As camadas de guia são travadas e não imprimem.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

import { zipSync, strToU8 } from "fflate";
import type { Camada, Grid } from "./calcular";

const DOM = "16.0";
const NS = 'xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"';
const CAB = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const n = (v: number) => {
  const s = v.toFixed(4).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type DefCamada = { id: string; nome: string; cor: string };

export const CAMADAS: Record<Camada | "rotacionado" | "conteudo" | "logo", DefCamada> = {
  conteudo: { id: "ly_conteudo", nome: "Conteúdo", cor: "Blue" },
  grid: { id: "ly_grid", nome: "Grid — proposta do Brennimark", cor: "Cyan" },
  zonas: { id: "ly_zonas", nome: "Zonas do hierárquico", cor: "Purple" },
  segura: { id: "ly_segura", nome: "Área segura da plataforma", cor: "Red" },
  dobras: { id: "ly_dobras", nome: "Dobras (lombada e orelhas)", cor: "Green" },
  sobreposto: { id: "ly_sobreposto", nome: "Desconstrução — grid sobreposto", cor: "Magenta" },
  rotacionado: { id: "ly_rotacionado", nome: "Desconstrução — grid rotacionado", cor: "Orange" },
  logo: { id: "ly_logo", nome: "Logo — área de proteção do manual", cor: "Red" },
};

/**
 * A MARCA no documento (Grids do assinante, 14/10/2026): o logo dos Materiais,
 * as cores aprovadas e os estilos de texto no corpo e na entrelinha do grid,
 * com a fonte da tipografia APROVADA da marca (`AppliedFont`, `FontStyle`,
 * `Tracking`, `Capitalization`) quando ela existe.
 *
 * A colocação do logo segue o que o PRÓPRIO InDesign escreve (exportado em
 * 14/10 com um PNG, um SVG e um .ai de prancheta grande colocados por script):
 *   - PDF/AI: elemento `PDF`, recorte na arte (`CropArt`), e `GraphicBounds`
 *     com os limites da arte nas coordenadas do PDF (Top = o menor y);
 *   - SVG: elemento `SVG`; PNG/JPEG: elemento `Image`; `GraphicBounds` do
 *     tamanho do desenho em pt.
 * O arquivo vai em `Links/`, ao lado do .idml, com caminho relativo (provado).
 */
export type LogoNoDocumento = {
  arquivo: string;
  formato: "pdf" | "svg" | "png" | "jpeg";
  /** Limites do desenho no espaço do arquivo (ver acima). */
  limites: { esq: number; sup: number; dir: number; inf: number };
  /** O quadro do logo e a área de proteção, em pt, nas coordenadas da página. */
  quadro: { x: number; y: number; w: number; h: number };
  protecao: { x: number; y: number; w: number; h: number } | null;
};
export type CorNoDocumento = { nome: string; cmyk: [number, number, number, number] | null; rgb: [number, number, number] };
/**
 * Um estilo de parágrafo. A `fonte` vem da tipografia APROVADA da marca
 * (14/10/2026): família e estilo pelo NOME — o InDesign acha a fonte instalada
 * e, se não houver, avisa que ela falta, que é o aviso honesto. O corpo e a
 * entrelinha continuam os do grid (o tamanho depende da peça).
 */
export type FonteDoEstilo = { familia: string; estilo: string; espacejamento: number | null; caixaAlta: boolean | null; origem: string };
export type EstiloNoDocumento = { nome: string; corpo: number; entrelinha: number; fonte?: FonteDoEstilo | null };
export type MarcaNoDocumento = {
  /** Como a camada do grid se chama: de onde ele veio ("do manual, p. 31 — aprovada"). */
  origemDoGrid: string;
  logo: LogoNoDocumento | null;
  cores: CorNoDocumento[];
  estilos: EstiloNoDocumento[];
};

const FORMATO_DO_LINK: Record<LogoNoDocumento["formato"], string> = {
  pdf: "$ID/Adobe Portable Document Format (PDF)", svg: "$ID/SVG",
  png: "$ID/Portable Network Graphics (PNG)", jpeg: "$ID/JPEG",
};

function elementosDoLogo(l: LogoNoDocumento, meio: number): string {
  const { x, y, w, h } = l.quadro;
  const lw = l.limites.dir - l.limites.esq;
  const s = w / lw;
  const tx = x - s * l.limites.esq;
  const ty = y - meio - s * l.limites.sup;
  const limites = `<GraphicBounds Left="${n(l.limites.esq)}" Top="${n(l.limites.sup)}" Right="${n(l.limites.dir)}" Bottom="${n(l.limites.inf)}"/>`;
  const link = `<Link Self="lk_logo" LinkResourceURI="file:Links/${esc(l.arquivo)}" LinkResourceFormat="${FORMATO_DO_LINK[l.formato]}" StoredState="Normal" LinkClassID="35906" LinkClientID="257"/>`;
  const transforma = `ItemTransform="${n(s)} 0 0 ${n(s)} ${n(tx)} ${n(ty)}"`;
  const conteudo = l.formato === "pdf"
    ? `<PDF Self="gr_logo" ${transforma}><Properties>${limites}</Properties><PDFAttribute PageNumber="1" PDFCrop="CropArt" TransparentBackground="true"/>${link}</PDF>`
    : l.formato === "svg"
      ? `<SVG Self="gr_logo" ${transforma}><Properties>${limites}</Properties>${link}</SVG>`
      : `<Image Self="gr_logo" ${transforma}><Properties><Profile type="string">$ID/None</Profile>${limites}</Properties>${link}</Image>`;
  const quadro = `<Rectangle Self="rc_logo" Name="Logo" ContentType="GraphicType" StoryTitle="$ID/" ItemLayer="${CAMADAS.logo.id}" ItemTransform="1 0 0 1 0 0" AppliedObjectStyle="ObjectStyle/$ID/[Normal Graphics Frame]">${caminhoRet(x, y - meio, x + w, y + h - meio)}${conteudo}</Rectangle>`;
  const p = l.protecao;
  const protecao = p
    ? `<Rectangle Self="rc_protecao" Name="Área de proteção do logo" ContentType="Unassigned" StoryTitle="$ID/" ItemLayer="${CAMADAS.logo.id}" Nonprinting="true" StrokeWeight="0.5" StrokeColor="Color/AreaDeProtecao" FillColor="Swatch/None" ItemTransform="1 0 0 1 0 0" AppliedObjectStyle="ObjectStyle/$ID/[None]">${caminhoRet(p.x, p.y - meio, p.x + p.w, p.y + p.h - meio)}</Rectangle>`
    : "";
  return protecao + quadro;
}

function caminhoRet(x0: number, y0: number, x1: number, y1: number) {
  return caminho([[x0, y0], [x0, y1], [x1, y1], [x1, y0]], false);
}

function caminho(pontos: [number, number][], aberto: boolean) {
  const a = pontos.map(([x, y]) => `<PathPointType Anchor="${n(x)} ${n(y)}" LeftDirection="${n(x)} ${n(y)}" RightDirection="${n(x)} ${n(y)}"/>`).join("");
  return `<Properties><PathGeometry><GeometryPathType PathOpen="${aberto}"><PathPointArray>${a}</PathPointArray></GeometryPathType></PathGeometry></Properties>`;
}

/** Os arquivos XML do pacote, por caminho — separado do zip para os testes lerem. */
export function arquivosDoIdml(g: Grid, marca?: MarcaNoDocumento): Record<string, string> {
  const meio = g.altura / 2;
  const interna = g.largura - g.margens.esq - g.margens.dir;
  const posicoes = g.colunasNaMargem
    ? g.colunas.faixas.flatMap(([a, b]) => [a - g.margens.esq, b - g.margens.esq])
    : [0, interna];
  const nCol = g.colunasNaMargem ? g.colunas.n : 1;

  const usadas = new Set<string>(["conteudo"]);
  if (marca?.logo) usadas.add("logo");
  const guias = g.guias.map((gd, i) => {
    usadas.add(gd.camada);
    const c = CAMADAS[gd.camada];
    // Guia: posição contada do topo/esquerda da PÁGINA (medido no protótipo).
    return `<Guide Self="gd${i + 1}" OverriddenPageItemProps="" Orientation="${gd.orientacao === "h" ? "Horizontal" : "Vertical"}" Location="${n(gd.pos)}" FitToPage="true" ViewThreshold="0" Locked="false" ItemLayer="${c.id}" PageIndex="0" GuideType="Ruler" GuideZone="0"><Properties><GuideColor type="enumeration">${c.cor}</GuideColor></Properties></Guide>`;
  });

  const linhas = (g.rotacionado?.segmentos ?? []).map(([x1, y1, x2, y2], i) => {
    usadas.add("rotacionado");
    return `<GraphicLine Self="gl${i + 1}" ItemLayer="${CAMADAS.rotacionado.id}" ContentType="Unassigned" StrokeWeight="0.5" StrokeColor="Color/GridRotacionado" FillColor="Swatch/None" Nonprinting="true" ItemTransform="1 0 0 1 0 0">${caminho([[x1, y1 - meio], [x2, y2 - meio]], true)}</GraphicLine>`;
  });

  const margem = `ColumnCount="${nCol}" ColumnGutter="${n(g.colunas.medianiz)}" Top="${n(g.margens.sup)}" Bottom="${n(g.margens.inf)}" Left="${n(g.margens.esq)}" Right="${n(g.margens.dir)}" ColumnDirection="Horizontal" ColumnsPositions="${posicoes.map(n).join(" ")}"`;

  const spread = `${CAB}<idPkg:Spread ${NS} DOMVersion="${DOM}"><Spread Self="sp1" PageCount="1" BindingLocation="0" AllowPageShuffle="true" ItemTransform="1 0 0 1 0 0" ShowMasterItems="true" PageTransitionType="None">`
    + `<Page Self="pg1" Name="1" AppliedMaster="n" GeometricBounds="0 0 ${n(g.altura)} ${n(g.largura)}" ItemTransform="1 0 0 1 0 ${n(-meio)}" MasterPageTransform="1 0 0 1 0 0" OverrideList="" TabOrder="" GridStartingPoint="TopOutside" UseMasterGrid="true">`
    + `<Properties><PageColor type="enumeration">UseMasterColor</PageColor></Properties><MarginPreference ${margem}/></Page>`
    + `${guias.join("")}${linhas.join("")}${marca?.logo ? elementosDoLogo(marca.logo, meio) : ""}</Spread></idPkg:Spread>`;

  const unid = g.unidade === "mm" ? "Millimeters" : "Pixels";
  const prefs = `${CAB}<idPkg:Preferences ${NS} DOMVersion="${DOM}">`
    + `<DocumentPreference PageHeight="${n(g.altura)}" PageWidth="${n(g.largura)}" PagesPerDocument="1" FacingPages="false" DocumentBleedTopOffset="${n(g.sangria)}" DocumentBleedBottomOffset="${n(g.sangria)}" DocumentBleedInsideOrLeftOffset="${n(g.sangria)}" DocumentBleedOutsideOrRightOffset="${n(g.sangria)}" DocumentBleedUniformSize="true" SlugTopOffset="0" SlugBottomOffset="0" SlugInsideOrLeftOffset="0" SlugRightOrOutsideOffset="0" DocumentSlugUniformSize="false" PreserveLayoutWhenShuffling="true" AllowPageShuffle="true" OverprintBlack="true" PageBinding="LeftToRight" ColumnDirection="Horizontal" Intent="${g.unidade === "mm" ? "PrintIntent" : "WebIntent"}"/>`
    + `<MarginPreference ${margem}/>`
    + `<GridPreference DocumentGridShown="false" DocumentGridSnapto="false" HorizontalGridlineDivision="72" HorizontalGridSubdivision="8" VerticalGridlineDivision="72" VerticalGridSubdivision="8" GridsInBack="true" BaselineGridShown="true" BaselineStart="${n(g.linhaDeBase.inicio)}" BaselineDivision="${n(g.linhaDeBase.passo)}" BaselineViewThreshold="25" BaselineGridRelativeOption="TopOfPageOfBaselineGridRelativeOption"><Properties><GridColor type="enumeration">LightGray</GridColor><BaselineColor type="enumeration">LightBlue</BaselineColor></Properties></GridPreference>`
    + `<GuidePreference GuidesInBack="false" GuidesLocked="false" GuidesShown="true" GuidesSnapto="true" RulerGuidesViewThreshold="5"/>`
    + `<ViewPreference HorizontalMeasurementUnits="${unid}" VerticalMeasurementUnits="${unid}" TypographicMeasurementUnits="Points" TextSizeMeasurementUnits="Points" ShowFrameEdges="true" ShowRulers="true" CursorKeyIncrement="1" PointsPerInch="72"/>`
    + `</idPkg:Preferences>`;

  const graphic = `${CAB}<idPkg:Graphic ${NS} DOMVersion="${DOM}">`
    + '<Color Self="Color/Black" Model="Process" Space="CMYK" ColorValue="0 0 0 100" Name="Black" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>'
    + '<Color Self="Color/Paper" Model="Process" Space="CMYK" ColorValue="0 0 0 0" Name="Paper" ColorEditable="true" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>'
    + '<Color Self="Color/Registration" Model="Registration" Space="CMYK" ColorValue="100 100 100 100" Name="Registration" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>'
    + (g.rotacionado ? '<Color Self="Color/GridRotacionado" Model="Process" Space="RGB" ColorValue="255 140 0" Name="Guia do grid rotacionado" ColorEditable="true" ColorRemovable="true" Visible="true" SwatchCreatorID="7937"/>' : "")
    + (marca?.logo?.protecao ? '<Color Self="Color/AreaDeProtecao" Model="Process" Space="RGB" ColorValue="230 38 38" Name="Guia da área de proteção" ColorEditable="true" ColorRemovable="true" Visible="true" SwatchCreatorID="7937"/>' : "")
    + (marca?.cores ?? []).map((c, i) => c.cmyk
      ? `<Color Self="Color/Marca${i + 1}" Model="Process" Space="CMYK" ColorValue="${c.cmyk.map(n).join(" ")}" Name="${esc(c.nome)}" ColorEditable="true" ColorRemovable="true" Visible="true" SwatchCreatorID="7937"/>`
      : `<Color Self="Color/Marca${i + 1}" Model="Process" Space="RGB" ColorValue="${c.rgb.join(" ")}" Name="${esc(c.nome)}" ColorEditable="true" ColorRemovable="true" Visible="true" SwatchCreatorID="7937"/>`).join("")
    + '<Ink Self="Ink/$ID/Process Cyan" Name="$ID/Process Cyan" IsProcessInk="true"/><Ink Self="Ink/$ID/Process Magenta" Name="$ID/Process Magenta" IsProcessInk="true"/>'
    + '<Ink Self="Ink/$ID/Process Yellow" Name="$ID/Process Yellow" IsProcessInk="true"/><Ink Self="Ink/$ID/Process Black" Name="$ID/Process Black" IsProcessInk="true"/>'
    + '<Swatch Self="Swatch/None" Name="None" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>'
    + '<StrokeStyle Self="StrokeStyle/$ID/Solid" Name="$ID/Solid"/>'
    + '</idPkg:Graphic>';

  const styles = `${CAB}<idPkg:Styles ${NS} DOMVersion="${DOM}">`
    + '<RootCharacterStyleGroup Self="u79"><CharacterStyle Self="CharacterStyle/$ID/[No character style]" Imported="false" Name="$ID/[No character style]"/></RootCharacterStyleGroup>'
    + '<RootParagraphStyleGroup Self="u78"><ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]" Imported="false"/>'
    + '<ParagraphStyle Self="ParagraphStyle/$ID/NormalParagraphStyle" Name="$ID/NormalParagraphStyle" Imported="false"><Properties><BasedOn type="string">$ID/[No paragraph style]</BasedOn></Properties></ParagraphStyle>'
    + (marca?.estilos ?? []).map((e, i) => {
      const f = e.fonte;
      const atributos = f
        ? (f.estilo ? ` FontStyle="${esc(f.estilo)}"` : "")
          + (f.espacejamento !== null ? ` Tracking="${n(f.espacejamento)}"` : "")
          + (f.caixaAlta === true ? ' Capitalization="AllCaps"' : "")
        : "";
      const familia = f ? `<AppliedFont type="string">${esc(f.familia)}</AppliedFont>` : "";
      return `<ParagraphStyle Self="ParagraphStyle/Marca${i + 1}" Name="${esc(e.nome)}" Imported="false" PointSize="${n(e.corpo)}"${atributos} AlignToBaseline="true"><Properties><BasedOn type="string">$ID/NormalParagraphStyle</BasedOn>${familia}<Leading type="unit">${n(e.entrelinha)}</Leading></Properties></ParagraphStyle>`;
    }).join("")
    + '</RootParagraphStyleGroup>'
    + '<RootCellStyleGroup Self="u8f"><CellStyle Self="CellStyle/$ID/[None]" Name="$ID/[None]"/></RootCellStyleGroup>'
    + '<RootTableStyleGroup Self="u90"><TableStyle Self="TableStyle/$ID/[No table style]" Name="$ID/[No table style]"/><TableStyle Self="TableStyle/$ID/[Basic Table]" Name="$ID/[Basic Table]"/></RootTableStyleGroup>'
    + '<RootObjectStyleGroup Self="u91"><ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]"/><ObjectStyle Self="ObjectStyle/$ID/[Normal Graphics Frame]" Name="$ID/[Normal Graphics Frame]"/><ObjectStyle Self="ObjectStyle/$ID/[Normal Text Frame]" Name="$ID/[Normal Text Frame]"/><ObjectStyle Self="ObjectStyle/$ID/[Normal Grid]" Name="$ID/[Normal Grid]"/></RootObjectStyleGroup>'
    + '</idPkg:Styles>';

  // Camadas: as de guia travadas e não imprimíveis, POR CIMA; Conteúdo embaixo,
  // ativa. No IDML, a ÚLTIMA camada escrita fica em cima (medido no InDesign
  // em 13/10: escrever o Conteúdo por último deixava o grid por baixo dele).
  const ordem: (keyof typeof CAMADAS)[] = ["conteudo", "grid", "zonas", "segura", "dobras", "sobreposto", "rotacionado"];
  const ordemComLogo: (keyof typeof CAMADAS)[] = ["conteudo", "logo", ...ordem.slice(1)];
  const camadas = ordemComLogo.filter((c) => usadas.has(c) || c === "grid").map((c) => {
    const d = CAMADAS[c];
    const guia = c !== "conteudo" && c !== "logo";
    const nome = c === "grid" && marca ? `Grid — ${marca.origemDoGrid}` : d.nome;
    return `<Layer Self="${d.id}" Name="${esc(nome)}" Visible="true" Locked="${guia}" IgnoreWrap="false" ShowGuides="true" LockGuides="false" UI="true" Expendable="true" Printable="${!guia}"><Properties><LayerColor type="enumeration">${d.cor}</LayerColor></Properties></Layer>`;
  });

  const designmap = `${CAB}<?aid style="50" type="document" readerVersion="6.0" featureSet="257" product="16.0(32)" ?>\n`
    + `<Document ${NS} DOMVersion="${DOM}" Self="d" StoryList="" ZeroPoint="0 0" ActiveLayer="ly_conteudo" CMYKProfile="Coated FOGRA39 (ISO 12647-2:2004)" RGBProfile="sRGB IEC61966-2.1" SolidColorIntent="UseColorSettings" AfterBlendingIntent="UseColorSettings" DefaultImageIntent="UseColorSettings" RGBPolicy="PreserveEmbeddedProfiles" CMYKPolicy="CombinationOfPreserveAndSafeCmyk" AccurateLABSpots="false">`
    + '<idPkg:Graphic src="Resources/Graphic.xml"/><idPkg:Fonts src="Resources/Fonts.xml"/><idPkg:Styles src="Resources/Styles.xml"/><idPkg:Preferences src="Resources/Preferences.xml"/>'
    + camadas.join("")
    + '<idPkg:Spread src="Spreads/Spread_sp1.xml"/><idPkg:BackingStory src="XML/BackingStory.xml"/>'
    + '</Document>';

  return {
    "designmap.xml": designmap,
    "META-INF/container.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="designmap.xml" media-type="text/xml"/></rootfiles></container>',
    "Resources/Graphic.xml": graphic,
    "Resources/Fonts.xml": `${CAB}<idPkg:Fonts ${NS} DOMVersion="${DOM}"/>`,
    "Resources/Styles.xml": styles,
    "Resources/Preferences.xml": prefs,
    "Spreads/Spread_sp1.xml": spread,
    "XML/BackingStory.xml": `${CAB}<idPkg:BackingStory ${NS} DOMVersion="${DOM}"><XmlStory Self="ubs" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n"><ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle"><CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"/></ParagraphStyleRange></XmlStory></idPkg:BackingStory>`,
  };
}

/** O pacote .idml: `mimetype` primeiro e sem compressão, o resto comprimido. */
export function montarIdml(g: Grid, marca?: MarcaNoDocumento): Uint8Array {
  const arquivos = arquivosDoIdml(g, marca);
  const zip: Record<string, [Uint8Array, { level: 0 | 6 }]> = {
    mimetype: [strToU8("application/vnd.adobe.indesign-idml-package"), { level: 0 }],
  };
  for (const [caminhoDoArquivo, xml] of Object.entries(arquivos)) zip[caminhoDoArquivo] = [strToU8(xml), { level: 6 }];
  return zipSync(zip);
}
