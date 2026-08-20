import assert from "node:assert/strict";
import test from "node:test";
import { flattenBlocksToFacts, parseDocBlocks, type DocBlock } from "./doc-blocks";

const sample: DocBlock[] = [
  { kind: "prose", title: "Princípio-mãe", paragraphs: ["A cor é guiada pelo contexto."] },
  {
    kind: "list",
    variant: "bullet",
    title: "Quando usar",
    items: [{ text: "Campanhas internas" }, { title: "Datas", text: "Comemorativas" }],
  },
  { kind: "callout", label: "Regra de ouro", text: "Se a mensagem pede empatia, o design pede contenção." },
  {
    kind: "swatches",
    items: [{ name: "Primária", hex: "#2B6CB0", rgb: "43 108 176", cmyk: "76 39 0 31" }],
  },
  { kind: "gallery", items: [{ src: "/brand/exemplo/post.jpg", alt: "Post interno", caption: "Campanha" }] },
  {
    kind: "section",
    marker: "#2B6CB0",
    title: "Território 1",
    subtitle: "Marca em alta voltagem",
    blocks: [{ kind: "swatches", items: [{ name: "Apoio", hex: "#F6AD55" }] }],
  },
];

test("aceita os seis tipos de bloco", () => {
  assert.deepEqual(parseDocBlocks(sample), sample);
});

test("aceita prose só com lead, sem parágrafos", () => {
  assert.ok(parseDocBlocks([{ kind: "prose", lead: "Uma abertura.", paragraphs: [] }]));
  assert.equal(parseDocBlocks([{ kind: "prose", paragraphs: [] }]), null);
});

test("rejeita entrada malformada em vez de renderizar quebrado", () => {
  assert.equal(parseDocBlocks(undefined), null);
  assert.equal(parseDocBlocks({}), null);
  assert.equal(parseDocBlocks([{ kind: "desconhecido" }]), null);
  assert.equal(parseDocBlocks([{ kind: "swatches", items: [{ name: "X", hex: "vermelho" }] }]), null);
  assert.equal(parseDocBlocks([{ kind: "callout" }]), null);
});

test("rejeita section aninhada dentro de section", () => {
  const nested = [
    {
      kind: "section",
      title: "Externa",
      blocks: [{ kind: "section", title: "Interna", blocks: [] }],
    },
  ];
  assert.equal(parseDocBlocks(nested), null);
});

test("achata blocos em fatos e prefixa o que vem de dentro de uma seção", () => {
  const facts = flattenBlocksToFacts(sample);

  assert.ok(facts.includes("Princípio-mãe"));
  assert.ok(facts.some((f) => f === "Quando usar — Datas: Comemorativas"));
  assert.ok(facts.some((f) => f.startsWith("Destaque (Regra de ouro):")));
  assert.ok(facts.some((f) => f.includes("#2B6CB0") && f.includes("CMYK 76 39 0 31")));
  assert.ok(facts.some((f) => f.startsWith("Referência visual: /brand/exemplo/post.jpg")));
  assert.ok(facts.includes("Seção: Território 1 — Marca em alta voltagem"));
  assert.ok(facts.includes("[Território 1] Apoio — HEX #F6AD55"));
});
