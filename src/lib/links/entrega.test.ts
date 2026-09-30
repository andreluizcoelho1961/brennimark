import assert from "node:assert/strict";
import test from "node:test";
import { liberarEntrega, type ArquivoAberto, type LinkAberto } from "./entrega";

const W = "w1";
const B = "b1";
const arq = (id: string, extra: Partial<ArquivoAberto> = {}): ArquivoAberto => ({
  id, atual_id: id, retirado: false, storage_path: `${W}/${B}/${id}.svg`, file_name: `${id}.svg`, ...extra,
});
const ativo = (arquivos: ArquivoAberto[]): LinkAberto => ({ estado: "ativo", link: { workspace_id: W, brand_id: B }, arquivos });

function montar(over: Partial<Parameters<typeof liberarEntrega>[0]> = {}) {
  const ordem: string[] = [];
  const deps: Parameters<typeof liberarEntrega>[0] = {
    pedidos: ["a", "b"],
    abrir: async () => { ordem.push("abrir"); return ativo([arq("a"), arq("b", { atual_id: "b2", storage_path: `${W}/${B}/b2.svg`, file_name: "b2.svg" })]); },
    pertenceAMarca: (c, w, b) => c.startsWith(`${w}/${b}/`),
    assinar: async (c) => { ordem.push(`assinar ${c}`); return `https://x/${c}`; },
    registrar: async (ids, versoes) => {
      ordem.push(`registrar ${ids.join(",")} ${versoes.join(",")}`);
      return { ok: true, linhas: ids.map((id, k) => ({ asset_id: id, atual_id: versoes[k], storage_path: "", file_name: `${versoes[k]}.svg` })) };
    },
    ...over,
  };
  return { deps, ordem };
}

test("assina ANTES de registrar e só emite depois dos dois — com a versão atual", async () => {
  const { deps, ordem } = montar();
  const r = await liberarEntrega(deps);
  assert.deepEqual(ordem, ["abrir", "assinar w1/b1/a.svg", "assinar w1/b1/b2.svg", "registrar a,b a,b2"]);
  assert.deepEqual(r, { tipo: "emitir", arquivos: [
    { id: "a", url: "https://x/w1/b1/a.svg", file_name: "a.svg" },
    { id: "b", url: "https://x/w1/b1/b2.svg", file_name: "b2.svg" },
  ] });
});

test("assinatura que falha: nada é registrado (sem download fantasma)", async () => {
  const { deps, ordem } = montar({ assinar: async () => null });
  assert.deepEqual(await liberarEntrega(deps), { tipo: "falha", etapa: "assinatura" });
  assert.equal(ordem.some((o) => o.startsWith("registrar")), false);
});

test("registro que falha: nenhum endereço sai", async () => {
  const { deps } = montar({ registrar: async () => ({ ok: false, motivo: "falha" }) });
  assert.deepEqual(await liberarEntrega(deps), { tipo: "falha", etapa: "registro" });
});

test("link que não está ativo não chega a assinar", async () => {
  for (const estado of ["inexistente", "expirado", "revogado"] as const) {
    const { deps, ordem } = montar({ abrir: async () => ({ estado }) });
    assert.deepEqual(await liberarEntrega(deps), { tipo: "indisponivel", estado });
    assert.deepEqual(ordem, []);
  }
});

test("arquivo de fora do link é recusado antes de qualquer assinatura", async () => {
  const { deps, ordem } = montar({ pedidos: ["a", "intruso"] });
  assert.deepEqual(await liberarEntrega(deps), { tipo: "recusado", motivo: "fora-do-link" });
  assert.deepEqual(ordem, ["abrir"]);
});

test("retirado de uso fica de fora; só retirados é recusa", async () => {
  const soRetirado = montar({ pedidos: ["r"], abrir: async () => ativo([arq("r", { retirado: true, atual_id: null, storage_path: null })]) });
  assert.deepEqual(await liberarEntrega(soRetirado.deps), { tipo: "recusado", motivo: "retirado" });

  const misto = montar({ pedidos: ["a", "r"], abrir: async () => ativo([arq("a"), arq("r", { retirado: true, atual_id: null, storage_path: null })]) });
  const r = await liberarEntrega(misto.deps);
  assert.equal(r.tipo, "emitir");
  assert.ok(misto.ordem.includes("registrar a a"));
});

test("caminho fora da pasta da marca do link: a chave de serviço não assina", async () => {
  const { deps, ordem } = montar({ abrir: async () => ativo([arq("a", { storage_path: "outra-conta/outra-marca/a.svg" }), arq("b")]) });
  assert.deepEqual(await liberarEntrega(deps), { tipo: "falha", etapa: "caminho" });
  assert.equal(ordem.some((o) => o.startsWith("assinar")), false);
});

test("versão que mudou entre assinar e registrar: nada sai", async () => {
  const recusada = montar({ registrar: async () => ({ ok: false, motivo: "mudou" }) });
  assert.deepEqual(await liberarEntrega(recusada.deps), { tipo: "falha", etapa: "mudou" });
  // A segunda trava: se o registro voltasse com outra versão, também não sai.
  const outra = montar({ registrar: async (ids) => ({ ok: true, linhas: ids.map((id) => ({ asset_id: id, atual_id: "outra", storage_path: "", file_name: "x" })) }) });
  assert.deepEqual(await liberarEntrega(outra.deps), { tipo: "falha", etapa: "mudou" });
});

test("identificação recusada pelo banco vira recusa, não falha", async () => {
  const { deps } = montar({ registrar: async () => ({ ok: false, motivo: "identificacao" }) });
  assert.deepEqual(await liberarEntrega(deps), { tipo: "recusado", motivo: "identificacao" });
});
