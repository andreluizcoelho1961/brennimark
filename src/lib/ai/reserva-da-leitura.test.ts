import assert from "node:assert/strict";
import test from "node:test";
import { ESPERA_DA_LEITURA_DE_PAGINAS_MS, devolverReserva, esperaDaLeitura } from "./reserva-da-leitura";

function clienteFalso(erro: { code: string } | null = null) {
  const chamadas: { tabela: string; valores: Record<string, unknown>; coluna?: string; valor?: unknown }[] = [];
  const cliente = {
    from(tabela: string) {
      const registro: { tabela: string; valores: Record<string, unknown>; coluna?: string; valor?: unknown } = { tabela, valores: {} };
      chamadas.push(registro);
      return {
        update(valores: Record<string, unknown>) {
          registro.valores = valores;
          return { eq: async (coluna: string, valor: unknown) => { registro.coluna = coluna; registro.valor = valor; return { error: erro }; } };
        },
      };
    },
  };
  return { cliente: cliente as never, chamadas };
}

test("devolver a reserva recua a data em 25 horas, só da marca pedida", async () => {
  const { cliente, chamadas } = clienteFalso();
  const antes = Date.now();
  await devolverReserva(cliente, "leituras_das_regras_de_grid", "marca-1");
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].tabela, "leituras_das_regras_de_grid");
  assert.equal(chamadas[0].coluna, "brand_id");
  assert.equal(chamadas[0].valor, "marca-1");
  const recuada = Date.parse(String(chamadas[0].valores.tentada_em));
  const horas = (antes - recuada) / 3_600_000;
  assert.ok(horas > 24.99 && horas < 25.01, `recuou ${horas} h`);
  // Passadas 24 h, a próxima reserva passa (a regra do banco é `< now() - 24 h`).
  assert.ok(Date.now() - recuada > 24 * 3_600_000);
});

test("se não conseguir devolver, não derruba a resposta", async () => {
  const { cliente } = clienteFalso({ code: "42501" });
  await assert.doesNotReject(devolverReserva(cliente, "leituras_da_tipografia", "marca-1"));
});

test("a leitura de páginas espera ao menos 50 s pelo primeiro trecho, nunca menos que o Console manda", () => {
  assert.equal(ESPERA_DA_LEITURA_DE_PAGINAS_MS, 50_000);
  assert.equal(esperaDaLeitura(20_000), 50_000, "o padrão do chat (20 s) era curto para 10 imagens");
  assert.equal(esperaDaLeitura(80_000), 80_000, "o Console pode pedir mais");
});
