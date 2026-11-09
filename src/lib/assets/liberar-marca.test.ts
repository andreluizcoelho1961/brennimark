import assert from "node:assert/strict";
import test from "node:test";
import { liberarMarca, MAXIMO_DA_MARCA, TETO_DA_MARCA_BYTES, type ArquivoDaMarca, type ItemDaMarca } from "./liberar-marca";

const SEM_EIXOS = { hierarquia: null, lockup: null, cor: null, polaridade: null, espaco_de_cor: null };
const ITENS: ItemDaMarca[] = [
  { id: "i-logo", nome: "Logotipo", tipo: "logo", licenca: null },
  { id: "i-fonte", nome: "Inter", tipo: "fonte", licenca: { tipo: "livre", titular: null, comoObter: null } },
];
const arquivo = (id: string, itemId: string, nome: string, extra: Partial<ArquivoDaMarca> = {}): ArquivoDaMarca =>
  ({ id, itemId, storagePath: `w/b/${nome}`, fileName: nome, tamanho: 1000, eixos: SEM_EIXOS, ...extra });

function deps(arquivos: ArquivoDaMarca[], mudar: Partial<Parameters<typeof liberarMarca>[0]> = {}) {
  const registrados: string[][] = [];
  return {
    registrados,
    d: {
      marca: "Acme", ingles: false,
      buscar: async () => ({ ok: true as const, itens: ITENS, arquivos }),
      pertenceAMarca: (p: string) => p.startsWith("w/b/"),
      assinar: async (caminhos: string[]) => new Map(caminhos.map((c) => [c, `https://assinado/${c}`])),
      registrar: async (ids: string[]) => { registrados.push(ids); return true; },
      ...mudar,
    },
  };
}

test("entrega logo e fonte, cada um na pasta do tipo, com LEIA-ME na raiz e na fonte", async () => {
  const { d, registrados } = deps([arquivo("a1", "i-logo", "logo.svg"), arquivo("a2", "i-fonte", "Inter-Regular.ttf"), arquivo("a3", "i-fonte", "Inter-Bold.ttf")]);
  const r = await liberarMarca(d);
  assert.equal(r.tipo, "emitir");
  if (r.tipo !== "emitir") return;
  assert.equal(r.nome, "acme-materiais.zip");
  assert.deepEqual(r.arquivos.map((a) => a.caminho).sort(), [
    "acme-materiais/fonte/inter/inter-bold.ttf", "acme-materiais/fonte/inter/inter-regular.ttf", "acme-materiais/logo/logotipo/logo.svg",
  ]);
  assert.deepEqual(r.extras.map((e) => e.caminho), ["acme-materiais/LEIA-ME.txt", "acme-materiais/fonte/inter/LEIA-ME.txt"]);
  assert.ok(r.extras[0].texto.includes("FONTES") && r.extras[1].texto.includes("Licença: Livre"));
  assert.deepEqual(registrados, [["a1", "a2", "a3"]], "registra todos, uma vez, antes de emitir");
});

test("só entrega o que pertence à marca", async () => {
  const { d } = deps([arquivo("a1", "i-logo", "logo.svg"), arquivo("a9", "i-logo", "outro.svg", { storagePath: "outra/marca/outro.svg" })]);
  const r = await liberarMarca(d);
  assert.ok(r.tipo === "emitir" && r.arquivos.length === 1);
});

test("marca sem arquivos: vazio, e nada é registrado", async () => {
  const { d, registrados } = deps([]);
  assert.deepEqual(await liberarMarca(d), { tipo: "vazio" });
  assert.equal(registrados.length, 0);
});

test("acima do máximo de arquivos ou de bytes, recusa dizendo qual — e não registra", async () => {
  const muitos = Array.from({ length: MAXIMO_DA_MARCA + 1 }, (_, i) => arquivo(`a${i}`, "i-logo", `f${i}.svg`));
  const a = deps(muitos);
  assert.deepEqual(await liberarMarca(a.d), { tipo: "grande-demais", total: MAXIMO_DA_MARCA + 1, maximo: MAXIMO_DA_MARCA });
  const b = deps([arquivo("a1", "i-logo", "a.svg", { tamanho: TETO_DA_MARCA_BYTES }), arquivo("a2", "i-logo", "b.svg", { tamanho: 1 })]);
  assert.deepEqual(await liberarMarca(b.d), { tipo: "pesado-demais", bytes: TETO_DA_MARCA_BYTES + 1, maximo: TETO_DA_MARCA_BYTES });
  assert.equal(a.registrados.length + b.registrados.length, 0);
});

test("assinatura parcial é falha inteira, e registro que falha não entrega nada", async () => {
  const parcial = deps([arquivo("a1", "i-logo", "a.svg"), arquivo("a2", "i-logo", "b.svg")], {
    assinar: async () => new Map([["w/b/a.svg", "https://x"]]),
  });
  assert.deepEqual(await liberarMarca(parcial.d), { tipo: "falha", etapa: "assinatura" });
  assert.equal(parcial.registrados.length, 0, "não registra o que não vai entregar");
  const semRegistro = deps([arquivo("a1", "i-logo", "a.svg")], { registrar: async () => false });
  assert.deepEqual(await liberarMarca(semRegistro.d), { tipo: "falha", etapa: "registro" });
  const semBusca = deps([], { buscar: async () => ({ ok: false as const }) });
  assert.deepEqual(await liberarMarca(semBusca.d), { tipo: "falha", etapa: "busca" });
});

test("itens com o mesmo nome não se sobrescrevem no ZIP", async () => {
  const dois: ItemDaMarca[] = [{ id: "x", nome: "Logo", tipo: "logo", licenca: null }, { id: "y", nome: "Logo", tipo: "logo", licenca: null }];
  const { d } = deps([arquivo("a1", "x", "logo.svg"), arquivo("a2", "y", "logo.svg", { storagePath: "w/b/logo2.svg" })], {
    buscar: async () => ({ ok: true as const, itens: dois, arquivos: [arquivo("a1", "x", "logo.svg"), arquivo("a2", "y", "logo.svg", { storagePath: "w/b/logo2.svg" })] }),
  });
  const r = await liberarMarca(d);
  assert.ok(r.tipo === "emitir");
  if (r.tipo === "emitir") assert.equal(new Set(r.arquivos.map((a) => a.caminho)).size, 2);
});
