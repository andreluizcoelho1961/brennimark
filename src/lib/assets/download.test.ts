import assert from "node:assert/strict";
import test from "node:test";
import { liberarDownload, type AssetParaDownload, type Busca } from "./download";

/**
 * Os casos que a revisão externa de 14/09 notou que faltavam: a assinatura que
 * falha e o banco que cai. Eram exatamente onde estavam os defeitos.
 */

const ASSET: AssetParaDownload = { id: "a1", storagePath: "w/m/fonte.otf", fileName: "fonte.otf" };

function espiao(sobrescrever: Partial<{
  busca: Busca;
  pertence: boolean;
  endereco: string | null;
  registrado: boolean;
}> = {}) {
  const ordem: string[] = [];
  return {
    ordem,
    deps: {
      buscar: async () => { ordem.push("buscar"); return sobrescrever.busca ?? { ok: true as const, asset: ASSET }; },
      pertenceAMarca: () => { ordem.push("pertence"); return sobrescrever.pertence ?? true; },
      assinar: async () => { ordem.push("assinar"); return "endereco" in sobrescrever ? sobrescrever.endereco! : "https://assinado/60s"; },
      registrar: async () => { ordem.push("registrar"); return sobrescrever.registrado ?? true; },
    },
  };
}

test("assinatura que falha NÃO deixa download no registro", async () => {
  // O defeito da primeira versão: registrava antes de assinar, e a linha
  // ficava afirmando um download que nunca aconteceu.
  const e = espiao({ endereco: null });
  const r = await liberarDownload(e.deps);
  assert.deepEqual(r, { tipo: "falha", etapa: "assinatura" });
  assert.ok(!e.ordem.includes("registrar"), "registrou um download que não aconteceu");
});

test("registro que falha NÃO entrega o endereço", async () => {
  // O arquivo não pode sair sem rastro: o endereço assinado fica na memória do
  // servidor e expira sozinho.
  const e = espiao({ registrado: false });
  const r = await liberarDownload(e.deps);
  assert.deepEqual(r, { tipo: "falha", etapa: "registro" });
  assert.ok(!("endereco" in r), "o endereço saiu sem registro");
});

test("erro de banco na busca é falha, não 'não encontrado'", async () => {
  const e = espiao({ busca: { ok: false } });
  const r = await liberarDownload(e.deps);
  assert.deepEqual(r, { tipo: "falha", etapa: "busca" });
  assert.deepEqual(e.ordem, ["buscar"], "seguiu adiante depois de o banco falhar");
});

test("asset inexistente é não encontrado, sem assinar nem registrar", async () => {
  const e = espiao({ busca: { ok: true, asset: null } });
  assert.deepEqual(await liberarDownload(e.deps), { tipo: "nao-encontrado" });
  assert.deepEqual(e.ordem, ["buscar"]);
});

test("caminho fora da marca não é assinado nem registrado", async () => {
  const e = espiao({ pertence: false });
  assert.deepEqual(await liberarDownload(e.deps), { tipo: "nao-encontrado" });
  assert.ok(!e.ordem.includes("assinar") && !e.ordem.includes("registrar"));
});

test("o caminho feliz assina, registra UMA vez, e só então emite", async () => {
  const e = espiao();
  const r = await liberarDownload(e.deps);
  assert.deepEqual(r, { tipo: "emitir", endereco: "https://assinado/60s" });
  assert.deepEqual(e.ordem, ["buscar", "pertence", "assinar", "registrar"]);
});
