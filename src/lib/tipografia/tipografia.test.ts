import assert from "node:assert/strict";
import test from "node:test";
import type { Trecho } from "../ai/recuperacao";
import {
  deLinhaDaTipografia, instrucoesDaTipografia, lerFonteEscrita, lerPaginasPedidas, lerTipografiaDaIA,
  medidasDaFonte, nomeDaFonte, ordenarTipografia, paginasDaTipografia, trechosDaTipografia, type FonteDaMarca,
} from "./tipografia";
import { buildChatSystemPrompt } from "../ai/brand-context";

const fonte = (p: Partial<FonteDaMarca>): FonteDaMarca => ({
  id: "f", uso: "texto", segmento: "", familia: "Inter", estilo: "", postscript: null, substituta: null,
  corpo: null, entrelinha: null, espacejamento: null, caixaAlta: null, descricao: "", pagina: null, ordem: 0,
  origem: "pessoa", status: "draft", aprovadoEm: null, ...p,
});

test("a fonte escrita passa pelas mesmas regras das constraints do banco", () => {
  const ok = lerFonteEscrita({ uso: "titulo", familia: "  Bradesco Sans ", estilo: "Bold", postscript: "BradescoSans-Bold", corpo: "32,5", entrelinha: "36", espacejamento: "-10", caixa_alta: "sim", pagina: "30" }, 64);
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.fonte.familia, "Bradesco Sans", "aparada");
  assert.equal(ok.fonte.corpo, 32.5, "vírgula decimal aceita");
  assert.equal(ok.fonte.espacejamento, -10);
  assert.equal(ok.fonte.caixa_alta, true);
  assert.equal(ok.fonte.substituta, null, "vazio vira nulo");
  assert.equal(ok.fonte.segmento, "");

  const motivo = (c: Record<string, unknown>, paginas: number | null = null) => {
    const r = lerFonteEscrita({ uso: "texto", familia: "Inter", ...c }, paginas);
    return r.ok ? "ok" : r.motivo;
  };
  assert.equal(motivo({ uso: "rodape" }), "uso");
  assert.equal(motivo({ familia: "   " }), "familia");
  assert.equal(motivo({ postscript: "Bradesco Sans Bold" }), "postscript", "PostScript não tem espaço");
  assert.equal(motivo({ corpo: 0 }), "corpo");
  assert.equal(motivo({ corpo: "abc" }), "corpo");
  assert.equal(motivo({ entrelinha: 2001 }), "entrelinha");
  assert.equal(motivo({ espacejamento: 10.5 }), "espacejamento", "inteiro");
  assert.equal(motivo({ espacejamento: -501 }), "espacejamento");
  assert.equal(motivo({ segmento: "x".repeat(61) }), "segmento");
  assert.equal(motivo({ pagina: 65 }, 64), "pagina", "além do manual");
  assert.equal(motivo({ pagina: 0 }), "pagina");
  assert.equal(motivo({ caixa_alta: "" }), "ok", "caixa alta não dita fica nula");
});

test("a linha do banco vira fonte; uso fora da lista é descartado", () => {
  const f = deLinhaDaTipografia({ id: "1", uso: "legenda", familia: "Inter", corpo: "9.5", caixa_alta: false, origem: "ia", status: "ready", aprovado_em: "2026-10-14" });
  assert.ok(f);
  assert.equal(f!.corpo, 9.5, "numeric chega como texto do PostgREST");
  assert.equal(f!.caixaAlta, false);
  assert.equal(f!.origem, "ia");
  assert.equal(deLinhaDaTipografia({ id: "2", uso: "rodape", familia: "X" }), null);
});

test("a ficha sai na ordem dos usos, segmento vazio antes", () => {
  const ordem = ordenarTipografia([
    fonte({ id: "a", uso: "apoio" }), fonte({ id: "b", uso: "texto", segmento: "digital" }),
    fonte({ id: "c", uso: "texto" }), fonte({ id: "d", uso: "titulo" }),
  ]).map((f) => f.id);
  assert.deepEqual(ordem, ["d", "c", "b", "a"]);
});

test("o nome e as medidas como a tela mostra", () => {
  assert.equal(nomeDaFonte(fonte({ familia: "Inter", estilo: "Bold" })), "Inter Bold");
  assert.equal(nomeDaFonte(fonte({ familia: "Inter" })), "Inter");
  assert.deepEqual(medidasDaFonte(fonte({ corpo: 9.5, entrelinha: 12, espacejamento: 20, caixaAlta: true })), ["9,5/12 pt", "espacejamento 20", "caixa alta"]);
  assert.deepEqual(medidasDaFonte(fonte({ corpo: 9.5 }), true), ["9.5 pt"]);
});

test("as páginas de tipografia, achadas pelo texto; complemento não conta", () => {
  const trecho = (pagina: number, content: string, origem?: "complemento"): Trecho => ({
    documentSlug: "s", documentTitle: "t", groupName: "g", section: null, status: "ready", pageStart: pagina, pageEnd: pagina, content, origem,
  } as Trecho);
  const paginas = paginasDaTipografia([
    trecho(12, "A paleta cromática"), trecho(31, "Família tipográfica secundária"), trecho(30, "Tipografia institucional"),
    trecho(30, "pesos da fonte"), trecho(40, "Fontes do complemento", "complemento"),
  ]);
  assert.deepEqual(paginas, [30, 31]);
});

test("as páginas digitadas: até 4, dentro do manual", () => {
  assert.deepEqual(lerPaginasPedidas("31, 30 30", 64), { ok: true, paginas: [30, 31] });
  assert.deepEqual(lerPaginasPedidas("", 64), { ok: true, paginas: [] });
  assert.deepEqual(lerPaginasPedidas("1,2,3,4,5", 64), { ok: false, motivo: "demais" });
  assert.deepEqual(lerPaginasPedidas("70", 64), { ok: false, motivo: "fora-do-manual" });
  assert.deepEqual(lerPaginasPedidas("trinta", 64), { ok: false, motivo: "formato" });
});

test("o pedido à IA diz as páginas e proíbe inventar", () => {
  const i = instrucoesDaTipografia([30, 31]);
  assert.match(i, /30, 31/);
  assert.match(i, /Nunca invente/);
  assert.match(i, /nunca deduza o nome pela aparência/);
});

test("a resposta da IA é conferida linha a linha", () => {
  const texto = [
    "Aqui está:",
    '{"uso": "titulo", "familia": "Bradesco Sans", "estilo": "Bold", "postscript": "BradescoSans-Bold", "corpo": 32, "entrelinha": 36, "pagina": 30}',
    '{"uso": "titulo", "familia": "Outra", "pagina": 30}',
    '{"uso": "texto", "familia": "Bradesco Sans", "estilo": "Regular", "postscript": "Bradesco Sans Regular", "substituta": "Arial", "espacejamento": 12.5, "caixa_alta": "sim", "pagina": 30}',
    '{"uso": "texto", "segmento": " digital ", "familia": "Arial", "pagina": 31}',
    '{"uso": "rodape", "familia": "X", "pagina": 30}',
    '{"uso": "legenda", "familia": "", "pagina": 30}',
    '{"uso": "apoio", "familia": "Georgia", "pagina": 99}',
    '{"uso": "destaque", "familia": "Bradesco Sans", "corpo": 5000, "pagina": 31}',
    "{quebrado",
  ].join("\n");
  const lidas = lerTipografiaDaIA(texto, [30, 31]);
  assert.deepEqual(lidas.map((l) => `${l.uso}|${l.segmento}`), ["titulo|", "texto|", "texto|digital", "destaque|"]);
  assert.equal(lidas[0].postscript, "BradescoSans-Bold");
  assert.equal(lidas[0].corpo, 32);
  assert.equal(lidas[1].postscript, undefined, "PostScript com espaço é descartado, a linha fica");
  assert.equal(lidas[1].substituta, "Arial");
  assert.equal(lidas[1].espacejamento, undefined, "espacejamento não inteiro descartado");
  assert.equal(lidas[1].caixa_alta, undefined, "caixa alta só booleana");
  assert.equal(lidas[3].corpo, undefined, "corpo além do teto descartado");
  assert.deepEqual(lidas.map((l) => l.ordem), [0, 1, 2, 3]);
});

// ─── A ficha para o Vini (15/10/2026) ───────────────────────────────────────

test("a ficha da tipografia: aprovadas e rascunho em fontes separadas, uma linha por uso", () => {
  const fontes = [
    fonte({ id: "1", uso: "texto", familia: "Sans de Bancada", estilo: "Regular", corpo: 9.5, entrelinha: 12, substituta: "Arial", pagina: 17, status: "ready" }),
    fonte({ id: "2", uso: "titulo", familia: "Sans de Bancada", estilo: "Bold", postscript: "SansDeBancada-Bold", pagina: 17, status: "ready" }),
    fonte({ id: "3", uso: "destaque", segmento: "Varejo", familia: "Sans de Bancada", descricao: "números grandes", pagina: 18, origem: "ia", status: "draft" }),
  ];
  const [aprovada, rascunho] = trechosDaTipografia(fontes, false);
  assert.equal(aprovada.documentSlug, "ficha-da-tipografia");
  assert.equal(aprovada.status, "ready");
  assert.equal(aprovada.pageStart, 17);
  assert.equal(aprovada.content, [
    "2 uso(s) definido(s); família(s): Sans de Bancada.",
    "- Título — Sans de Bancada Bold · PostScript SansDeBancada-Bold · p. 17",
    "- Texto — Sans de Bancada Regular · 9,5/12 pt · substituta Arial · p. 17",
  ].join("\n"), "título antes do texto");
  assert.equal(rascunho.documentSlug, "ficha-da-tipografia-rascunho");
  assert.equal(rascunho.status, "draft");
  assert.equal(rascunho.content.split("\n")[1], '- Destaque · segmento: Varejo — Sans de Bancada · p. 18 — "números grandes"');
  assert.deepEqual(trechosDaTipografia([], false), [], "sem fonte, nenhuma ficha");
});

test("a regra da tipografia só entra no prompt quando há ficha de tipografia", () => {
  const brand = { language: "pt", chatRole: "", analysisRole: "", statusLabels: undefined } as Parameters<typeof buildChatSystemPrompt>[1];
  const ficha = trechosDaTipografia([fonte({ uso: "titulo", status: "draft" })], false);
  const com = buildChatSystemPrompt([], brand, "", "trechos", ficha);
  assert.match(com, /As fontes "Ficha da tipografia" foram conferidas/);
  assert.match(com, /nunca ofereça o arquivo da fonte/);
  assert.doesNotMatch(com, /Ficha da paleta" foram conferidas/, "sem ficha da paleta, sem a regra dela");
  assert.doesNotMatch(buildChatSystemPrompt([], brand, "", "trechos", []), /Ficha da tipografia/);
});
