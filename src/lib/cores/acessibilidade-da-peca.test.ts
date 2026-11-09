import assert from "node:assert/strict";
import test from "node:test";
import {
  amostrarMediana, medirPar, passaNoUso, seConfundem, simularPixels, sugerirAjuste, truncar2, type CorAprovada,
} from "./acessibilidade-da-peca";
import { simularDaltonismo } from "./cores";

test("a amostra é a mediana da vizinhança, não a média entre texto e fundo", () => {
  // 5x5 branco com uma coluna de "letra" preta à esquerda (2 de 5 colunas): domina o branco.
  const w = 5, h = 5, d = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < 2; x++) { const p = (y * w + x) * 4; d[p] = d[p + 1] = d[p + 2] = 0; }
  assert.equal(amostrarMediana(d, w, h, 2, 2, 2), "#FFFFFF");
  // Na borda da imagem o quadrado é recortado, sem estourar.
  assert.equal(amostrarMediana(d, w, h, 0, 0, 2), "#000000");
});

test("medir o par: razão truncada, veredito e a razão sob cada daltonismo", () => {
  const m = medirPar("#000000", "#FFFFFF");
  assert.equal(m.razao, 21);
  assert.equal(m.veredito.textoPequeno, "AAA");
  assert.equal(m.sobDaltonismo.protanopia, 21);
  // Vermelho sobre verde de mesma luminância: razão perto de 1 e some para quem tem protanopia/deuteranopia.
  const rv = medirPar("#C0392B", "#2E8B3A");
  assert.ok(rv.sobDaltonismo.protanopia < 1.6 || rv.sobDaltonismo.deuteranopia < 1.6);
  assert.equal(truncar2(4.499999), 4.49);
  assert.equal(passaNoUso(4.49, "texto-comum"), false);
  assert.equal(passaNoUso(3, "icones-e-botoes"), true);
});

test("simular os pixels dá o mesmo que simular a cor, e preserva o alfa", () => {
  for (const tipo of ["protanopia", "deuteranopia", "tritanopia"] as const) {
    const d = new Uint8ClampedArray([200, 16, 46, 77, 0, 128, 0, 255]);
    simularPixels(d, tipo);
    const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    // Arredondamento: Uint8ClampedArray arredonda, rgbParaHex também; tolerância de 1 por canal.
    const esperado1 = simularDaltonismo("#C8102E", tipo), obtido1 = hex(d[0], d[1], d[2]);
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(parseInt(esperado1.slice(1 + 2 * c, 3 + 2 * c), 16) - parseInt(obtido1.slice(1 + 2 * c, 3 + 2 * c), 16)) <= 1, `${tipo} ${esperado1} ${obtido1}`);
    assert.equal(d[3], 77);
    assert.equal(d[7], 255);
  }
});

test("duas cores bem distintas que se confundem para um tipo são apontadas; cores já parecidas, não", () => {
  const achados = seConfundem("#C0392B", "#2E8B3A");
  assert.ok(achados.length > 0);
  assert.ok(achados.every((a) => a.diferencaSimulada < 10 && a.diferencaNormal >= 20));
  assert.deepEqual(seConfundem("#000000", "#FFFFFF"), []);
  assert.deepEqual(seConfundem("#C8102E", "#C8112E"), []);
});

const paleta: CorAprovada[] = [
  { nome: "Azul Noite", hex: "#0B1F3A", status: "ready" },
  { nome: "Branco", hex: "#FFFFFF", status: "ready" },
  { nome: "Amarelo Rascunho", hex: "#FFD400", status: "draft" },
];

test("par que já passa não pede ajuste", () => {
  assert.deepEqual(sugerirAjuste("#000000", "#FFFFFF", "texto-comum", paleta), { estado: "ja-passa" });
});

test("a sugestão vem só de cor APROVADA da paleta, a mais próxima primeiro", () => {
  // Cinza claro sobre branco falha; o Azul Noite e o Branco aprovados resolvem de jeitos diferentes.
  const a = sugerirAjuste("#CCCCCC", "#FFFFFF", "texto-comum", paleta);
  assert.equal(a.estado, "sugestoes");
  if (a.estado !== "sugestoes") return;
  assert.ok(a.sugestoes.length > 0);
  assert.ok(a.sugestoes.every((s) => s.nome !== "Amarelo Rascunho"));
  assert.ok(a.sugestoes.every((s) => s.razao >= 4.5));
  const texto = a.sugestoes.find((s) => s.alvo === "texto");
  assert.equal(texto?.nome, "Azul Noite");
});

test("sem cor aprovada que resolva, diz que nenhuma resolve — não inventa", () => {
  assert.deepEqual(sugerirAjuste("#CCCCCC", "#DDDDDD", "texto-comum", [{ nome: "Cinza", hex: "#D0D0D0", status: "ready" }]), { estado: "nenhuma" });
});

test("só rascunho ou paleta vazia: sem paleta aprovada", () => {
  assert.deepEqual(sugerirAjuste("#CCCCCC", "#FFFFFF", "texto-comum", [paleta[2]]), { estado: "sem-paleta" });
  assert.deepEqual(sugerirAjuste("#CCCCCC", "#FFFFFF", "texto-comum", []), { estado: "sem-paleta" });
});

test("o uso muda o limite: 3,5:1 passa em texto grande e falha em texto comum", () => {
  const p: CorAprovada[] = [];
  assert.equal(sugerirAjuste("#8A8A8A", "#FFFFFF", "texto-grande", p).estado, "ja-passa");
  assert.equal(sugerirAjuste("#8A8A8A", "#FFFFFF", "texto-comum", p).estado, "sem-paleta");
});
