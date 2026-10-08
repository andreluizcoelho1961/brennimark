import assert from "node:assert/strict";
import test from "node:test";
import { rodarContasCanceladas, type ContaAAvisar, type ContaAExcluir, type PortasDaRotina } from "./contas-canceladas";

const AVISAR: ContaAAvisar = { idAssinatura: "sub_1", email: "dona@agencia.com", nomeDaConta: "Agência", excluirEm: "2027-10-08T00:00:00Z" };

function portasFalsas(o: {
  avisar?: ContaAAvisar[]; excluir?: ContaAExcluir[]; reservaPerdida?: boolean; falharEm?: string;
  desfecho?: "pendente" | "excluida"; relogio?: number[];
} = {}) {
  const chamadas: string[] = [];
  const relogio = [...(o.relogio ?? [])];
  const portas: PortasDaRotina = {
    async contasAAvisar() { chamadas.push("listar avisos"); return o.avisar ?? []; },
    async reservarAviso(id, reservar) { chamadas.push(`${reservar ? "reservar" : "devolver"} ${id}`); return reservar ? !o.reservaPerdida : true; },
    async avisar(c) { chamadas.push(`e-mail ${c.email}`); if (o.falharEm === "e-mail") throw new Error("recusado"); },
    async contasAExcluir() { chamadas.push("listar exclusões"); return o.excluir ?? []; },
    async iniciarExclusao(c) { chamadas.push(`iniciar ${c}`); if (o.falharEm === `iniciar ${c}`) throw new Error("iniciar: 55000 exclusao_sem_aviso"); return 3; },
    async drenar(c) { chamadas.push(`drenar ${c}`); return { removidos: 3, pendentes: 0 }; },
    async concluirExclusao(c) { chamadas.push(`concluir ${c}`); return o.desfecho ?? "excluida"; },
    agora: () => relogio.shift() ?? 0,
  };
  return { portas, chamadas };
}

test("avisa: reserva ANTES de enviar, e conta o aviso", async () => {
  const { portas, chamadas } = portasFalsas({ avisar: [AVISAR] });
  const r = await rodarContasCanceladas(portas);
  assert.deepEqual(chamadas, ["listar avisos", "reservar sub_1", "e-mail dona@agencia.com", "listar exclusões"]);
  assert.equal(r.avisadas, 1);
  assert.deepEqual(r.falhas, []);
});

test("outra execução já reservou: nenhum e-mail", async () => {
  const { portas, chamadas } = portasFalsas({ avisar: [AVISAR], reservaPerdida: true });
  const r = await rodarContasCanceladas(portas);
  assert.ok(!chamadas.some((c) => c.startsWith("e-mail")));
  assert.equal(r.avisadas, 0);
});

test("o e-mail falhou: a reserva volta (o prazo de 30 dias só conta do aviso que saiu)", async () => {
  const { portas, chamadas } = portasFalsas({ avisar: [AVISAR], falharEm: "e-mail" });
  const r = await rodarContasCanceladas(portas);
  assert.deepEqual(chamadas.slice(1, 4), ["reservar sub_1", "e-mail dona@agencia.com", "devolver sub_1"]);
  assert.equal(r.avisadas, 0);
  assert.match(r.falhas[0], /aviso sub_1: recusado/);
});

test("exclusão nova: inicia, drena e conclui — nessa ordem", async () => {
  const { portas, chamadas } = portasFalsas({ excluir: [{ conta: "c1", iniciada: false }] });
  const r = await rodarContasCanceladas(portas);
  assert.deepEqual(chamadas.slice(2), ["iniciar c1", "drenar c1", "concluir c1"]);
  assert.deepEqual({ ...r, falhas: undefined }, { avisadas: 0, iniciadas: 1, arquivosRemovidos: 3, excluidas: 1, pendentes: 0, falhas: undefined });
});

test("exclusão já iniciada: não inicia de novo, continua de onde parou", async () => {
  const { portas, chamadas } = portasFalsas({ excluir: [{ conta: "c1", iniciada: true }], desfecho: "pendente" });
  const r = await rodarContasCanceladas(portas);
  assert.deepEqual(chamadas.slice(2), ["drenar c1", "concluir c1"]);
  assert.equal(r.pendentes, 1);
  assert.equal(r.excluidas, 0);
});

test("o banco recusou uma conta: as outras seguem, e a falha aparece", async () => {
  const { portas, chamadas } = portasFalsas({
    excluir: [{ conta: "c1", iniciada: false }, { conta: "c2", iniciada: false }], falharEm: "iniciar c1",
  });
  const r = await rodarContasCanceladas(portas);
  assert.ok(!chamadas.includes("drenar c1") && !chamadas.includes("concluir c1"));
  assert.ok(chamadas.includes("concluir c2"));
  assert.equal(r.excluidas, 1);
  assert.match(r.falhas[0], /exclusão c1: iniciar: 55000 exclusao_sem_aviso/);
});

test("sem tempo: para entre contas, e o resto fica para amanhã", async () => {
  // início = 0; a 1ª conferência (antes de c1) vê 1 ms; a 2ª (antes de c2) vê 60 s.
  const { portas, chamadas } = portasFalsas({
    excluir: [{ conta: "c1", iniciada: true }, { conta: "c2", iniciada: true }], relogio: [0, 1, 60_000],
  });
  await rodarContasCanceladas(portas, 45_000);
  assert.ok(chamadas.includes("concluir c1"));
  assert.ok(!chamadas.includes("drenar c2"));
});
