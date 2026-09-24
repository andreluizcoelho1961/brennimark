import assert from "node:assert/strict";
import test from "node:test";
import { liberarKit, type ArquivoDoKit } from "./liberar-kit";

const eixos = { hierarquia: "principal", lockup: "horizontal", cor: "colorido", polaridade: "positivo", espaco_de_cor: "rgb" } as const;
const arq = (id: string, storagePath = `w/b/${id}-logo.svg`): ArquivoDoKit => ({ id, storagePath, fileName: `${id}.svg`, eixos: { ...eixos } });

function deps(over: Partial<Parameters<typeof liberarKit>[0]> = {}) {
  const chamadas: string[] = [];
  return {
    chamadas,
    d: {
      marca: "Sony Vaio",
      buscar: async () => ({ ok: true as const, item: { nome: "Logotipo" }, arquivos: [arq("a"), arq("b")] }),
      pertenceAMarca: (c: string) => c.startsWith("w/b/"),
      assinar: async (cs: string[]) => { chamadas.push("assinar"); return new Map(cs.map((c) => [c, `https://x/${c}`])); },
      registrar: async (ids: string[]) => { chamadas.push(`registrar:${ids.join(",")}`); return true; },
      ...over,
    },
  };
}

test("assina, registra e só então entrega — com o caminho de cada arquivo no ZIP", async () => {
  const { d, chamadas } = deps();
  const r = await liberarKit(d);
  assert.equal(r.tipo, "emitir");
  if (r.tipo !== "emitir") return;
  assert.equal(r.nome, "sony-vaio-logotipo.zip");
  assert.deepEqual(r.arquivos.map((a) => a.caminho), [
    "sony-vaio-logotipo/principal/horizontal/colorido-positivo-rgb/a.svg",
    "sony-vaio-logotipo/principal/horizontal/colorido-positivo-rgb/b.svg",
  ]);
  assert.deepEqual(chamadas, ["assinar", "registrar:a,b"]);
});

test("registro que falha: nenhum endereço sai", async () => {
  const { d } = deps({ registrar: async () => false });
  assert.deepEqual(await liberarKit(d), { tipo: "falha", etapa: "registro" });
});

test("assinatura parcial é falha inteira — e nada se registra", async () => {
  const { d, chamadas } = deps({
    assinar: async (cs: string[]) => { chamadas.push("assinar"); return new Map([[cs[0], "https://x"]]); },
  });
  assert.deepEqual(await liberarKit(d), { tipo: "falha", etapa: "assinatura" });
  assert.ok(!chamadas.some((c) => c.startsWith("registrar")));
});

test("arquivo com caminho fora da marca não entra, nem é registrado", async () => {
  const { d, chamadas } = deps({
    buscar: async () => ({ ok: true as const, item: { nome: "Logo" }, arquivos: [arq("a"), arq("x", "outra/marca/x.svg")] }),
  });
  const r = await liberarKit(d);
  assert.equal(r.tipo, "emitir");
  assert.ok(chamadas.includes("registrar:a"));
});

test("item de outra marca, item vazio e busca que falha", async () => {
  assert.deepEqual(await liberarKit(deps({ buscar: async () => ({ ok: true as const, item: null, arquivos: [] }) }).d), { tipo: "nao-encontrado" });
  assert.deepEqual(await liberarKit(deps({ buscar: async () => ({ ok: true as const, item: { nome: "L" }, arquivos: [] }) }).d), { tipo: "vazio" });
  assert.deepEqual(await liberarKit(deps({ buscar: async () => ({ ok: false as const }) }).d), { tipo: "falha", etapa: "busca" });
});
