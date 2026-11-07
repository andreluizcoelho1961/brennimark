import assert from "node:assert/strict";
import test from "node:test";
import {
  contrastesDaPaleta, trechosDoContraste, truncar2, usosAtendidos, LIMITE_DE_LINHAS_DO_CONTRASTE,
  SLUG_DO_CONTRASTE, SLUG_DO_CONTRASTE_EM_RASCUNHO, type CorMedida,
} from "./contraste";

function cor(nome: string, hex: string | null, parcial: Partial<CorMedida> = {}): CorMedida {
  return { nome, hex, status: "ready", papel: "apoio", ordem: 0, ...parcial };
}

test("preto no branco é 21:1 e passa em tudo; cinza claro no branco falha", () => {
  const r = contrastesDaPaleta([cor("Preto", "#000000", { ordem: 0 }), cor("Cinza", "#DDDDDD", { ordem: 1 })]);
  const [pretoBranco, pretoPreto, cinzaBranco] = r.sobreReferencias;
  assert.equal(pretoBranco.razao, 21);
  assert.deepEqual(pretoBranco.veredito, { textoPequeno: "AAA", textoGrande: "AAA", iconesEBotoes: "passa" });
  assert.equal(pretoPreto.razao, 1);
  assert.deepEqual(pretoPreto.veredito, { textoPequeno: "falha", textoGrande: "falha", iconesEBotoes: "falha" });
  assert.ok(cinzaBranco.razao < 1.5);
  assert.equal(usosAtendidos(cinzaBranco.veredito), 0);
});

test("a razão é truncada, nunca arredondada para cima: 4,499 não passa como 4,5", () => {
  assert.equal(truncar2(4.499999), 4.49);
  assert.equal(truncar2(4.5), 4.5);
  assert.equal(truncar2(4.505), 4.5);
  assert.equal(truncar2(21), 21);
  // #767676 sobre branco é o limite clássico: 4,54:1, passa em texto comum.
  const limite = contrastesDaPaleta([cor("Cinza AA", "#767676")]).sobreReferencias[0];
  assert.equal(limite.razao, 4.54);
  assert.equal(limite.veredito.textoPequeno, "AA");
  // #777777 sobre branco é 4,47:1: falha em texto comum, passa em texto grande.
  const abaixo = contrastesDaPaleta([cor("Cinza quase", "#777777")]).sobreReferencias[0];
  assert.equal(abaixo.razao, 4.47);
  assert.equal(abaixo.veredito.textoPequeno, "falha");
  assert.equal(abaixo.veredito.textoGrande, "AA");
  assert.equal(abaixo.veredito.iconesEBotoes, "passa");
});

test("cada par de cores aparece uma vez só, e a ordem é a da paleta (principais antes)", () => {
  const r = contrastesDaPaleta([
    cor("C", "#FFFFFF", { ordem: 2 }),
    cor("A", "#000000", { papel: "principal" }),
    cor("B", "#FF0000", { ordem: 1 }),
  ]);
  assert.equal(r.entreCores.length, 3);
  assert.deepEqual(r.entreCores.map((p) => p.a.tipo === "cor" && p.b.tipo === "cor" ? `${p.a.nome}${p.b.nome}` : ""), ["AB", "AC", "BC"]);
  assert.equal(r.sobreReferencias.length, 6);
});

test("par com cor em rascunho não é afirmado; branco e preto são neutros", () => {
  const r = contrastesDaPaleta([cor("Aprovada", "#000000"), cor("Rascunho", "#FF0000", { status: "draft" })]);
  const [aprovadaBranco, , rascunhoBranco] = r.sobreReferencias;
  assert.equal(aprovadaBranco.afirmado, true);
  assert.equal(rascunhoBranco.afirmado, false);
  assert.equal(r.entreCores[0].afirmado, false);
});

test("cor sem HEX não é medida: sai em semHex, e não vira par", () => {
  const r = contrastesDaPaleta([cor("Só Pantone", null), cor("Preto", "#000000")]);
  assert.deepEqual(r.semHex, [{ nome: "Só Pantone", status: "ready" }]);
  assert.equal(r.entreCores.length, 0);
  assert.equal(r.sobreReferencias.length, 2);
});

test("paleta vazia não mede nada", () => {
  assert.deepEqual(contrastesDaPaleta([]), { sobreReferencias: [], entreCores: [], semHex: [] });
  assert.deepEqual(trechosDoContraste([], false), []);
});

test("o Vini recebe duas fontes: pares aprovados e pares com rascunho, cada uma com o seu status", () => {
  const trechos = trechosDoContraste([
    cor("Vermelho", "#C8102E"),
    cor("Azul Noite", "#0B1F3A", { status: "draft" }),
    cor("Só Pantone", null),
  ], false);
  const [aprovado, rascunho] = trechos;
  assert.equal(aprovado.documentSlug, SLUG_DO_CONTRASTE);
  assert.equal(aprovado.status, "ready");
  assert.match(aprovado.content, /Vermelho × branco: \d+\.\d{2}:1/);
  assert.doesNotMatch(aprovado.content, /Azul Noite/);
  assert.match(aprovado.content, /NÃO medidas \(sem HEX na ficha\): Só Pantone/);
  assert.equal(rascunho.documentSlug, SLUG_DO_CONTRASTE_EM_RASCUNHO);
  assert.equal(rascunho.status, "draft");
  assert.match(rascunho.content, /Azul Noite \(rascunho\) × preto/);
  assert.match(rascunho.content, /Azul Noite \(rascunho\) × Vermelho: \d+\.\d{2}:1/);
});

test("em inglês, o texto e a marca de rascunho acompanham o idioma", () => {
  const [t] = trechosDoContraste([cor("Navy", "#0B1F3A", { status: "draft" })], true);
  assert.equal(t.documentSlug, SLUG_DO_CONTRASTE_EM_RASCUNHO);
  assert.match(t.content, /Navy \(draft\) × white/);
  assert.match(t.content, /normal text pass/);
});

test("paleta grande não estoura o prompt: lista só os pares que chegam a 3:1 e diz que o resto foi medido e falha", () => {
  const muitas = Array.from({ length: 19 }, (_, i) => {
    const v = Math.round((i / 18) * 255).toString(16).padStart(2, "0").toUpperCase();
    return cor(`Tom ${i}`, `#${v}${v}${v}`, { ordem: i });
  });
  const r = contrastesDaPaleta(muitas);
  assert.ok(r.sobreReferencias.length + r.entreCores.length > LIMITE_DE_LINHAS_DO_CONTRASTE);

  const [t] = trechosDoContraste(muitas, false);
  assert.match(t.content, /Só os pares que chegam a 3:1 estão listados/);
  assert.match(t.content, /ABAIXO de 3:1/);
  const listadas = t.content.split("\n").filter((l) => l.startsWith("- "));
  assert.ok(listadas.length < r.sobreReferencias.length + r.entreCores.length);
  // Nenhuma linha listada fica abaixo de 3:1.
  for (const l of listadas) assert.ok(Number(/: (\d+\.\d{2}):1/.exec(l)![1]) >= 3, l);
  assert.ok(t.content.length < 14_000, `fonte grande demais: ${t.content.length}`);
});

test("no prompt, a regra do contraste só vai quando há fonte de contraste", async () => {
  const { buildChatSystemPrompt } = await import("../ai/brand-context");
  const brand = { language: "pt" as const, chatRole: "", analysisRole: "", statusLabels: undefined };
  const com = buildChatSystemPrompt([], brand, "", "trechos", trechosDoContraste([cor("Preto", "#000000")], false));
  assert.match(com, /razões MEDIDAS pela plataforma/);
  assert.match(com, /"não medi"/);
  assert.match(com, /Contraste da paleta \(cores aprovadas\)/);
  const sem = buildChatSystemPrompt([], brand, "", "trechos", []);
  assert.doesNotMatch(sem, /razões MEDIDAS pela plataforma/);
});

test("pares da paleta que se confundem para daltonismo, com o status atravessando", async () => {
  const { paresQueSeConfundem } = await import("./contraste");
  const achados = paresQueSeConfundem([
    cor("Vermelho", "#C0392B"),
    cor("Verde", "#2E8B3A", { status: "draft" }),
    cor("Preto", "#000000"),
    cor("Só Pantone", null),
  ]);
  assert.ok(achados.length > 0);
  assert.ok(achados.every((a) => [a.nomeA, a.nomeB].sort().join("/") === "Verde/Vermelho" && a.afirmado === false));
  assert.deepEqual(paresQueSeConfundem([cor("Preto", "#000000"), cor("Branco", "#FFFFFF")]), []);
});

test("o Vini recebe os pares que se confundem, como simulação aproximada e no grupo do status certo", () => {
  const [aprovado, rascunho] = trechosDoContraste([
    cor("Vermelho", "#C0392B"),
    cor("Verde", "#2E8B3A", { status: "draft" }),
    cor("Vermelho 2", "#B03A2E"),
    cor("Verde 2", "#2D8A3D"),
  ], false);
  // Vermelho × Vermelho 2 e Verde 2 × Vermelho são aprovados; os que envolvem "Verde" (rascunho) ficam no outro grupo.
  assert.doesNotMatch(aprovado.content, /Verde \/|\/ Verde:/);
  assert.match(rascunho.content, /simulação APROXIMADA/);
  assert.match(rascunho.content, /Verde/);
  // Linha de confusão: "Nome / Nome: tipos".
  assert.match([aprovado.content, rascunho.content].join("\n"), /^- [^:]+ \/ [^:]+: (protanopia|deuteranopia|tritanopia)/m);
});

test("sem pares que se confundem, a fonte não ganha o bloco de daltonismo", () => {
  const [t] = trechosDoContraste([cor("Preto", "#000000"), cor("Branco", "#FFFFFF")], false);
  assert.doesNotMatch(t.content, /daltonismo/);
});

test("a regra do prompt manda sugerir só cor aprovada da paleta", async () => {
  const { buildChatSystemPrompt } = await import("../ai/brand-context");
  const brand = { language: "pt" as const, chatRole: "", analysisRole: "", statusLabels: undefined };
  const p = buildChatSystemPrompt([], brand, "", "trechos", trechosDoContraste([cor("Preto", "#000000")], false));
  assert.match(p, /SÓ cores aprovadas da paleta/);
  assert.match(p, /Nunca invente nem sugira cor fora da paleta/);
});
