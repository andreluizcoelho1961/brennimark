import assert from "node:assert/strict";
import test from "node:test";
import { planoDaConta, voltaDoPortal, type LinhaDaAssinatura } from "./plano-da-conta";
import { mensagemDeOrcamento } from "../ai/orcamento";
import { caminhoPublico } from "../supabase/caminhos-publicos";

const ASSINATURA: LinhaDaAssinatura = {
  plano: "basico", situacao: "ativa", em_atraso_desde: null, periodo_pago_ate: "2026-11-01T00:00:00Z",
  cancelar_no_fim: false, moeda: "BRL", titular_email: "dona@agencia.com",
};

test("conta sem assinatura (aberta pela equipe) não mostra plano", () => {
  assert.deepEqual(planoDaConta({ assinatura: null, plano: null, marcas: 3, acesso: "livre", soLeituraAPartirDe: null }), { assinada: false });
});

test("o plano da conta: nome do plano, marcas usadas do limite, pago até", () => {
  const p = planoDaConta({ assinatura: ASSINATURA, plano: { codigo: "basico", nome: "Básico", maximo_de_marcas: 5 }, marcas: 3, acesso: "ativa", soLeituraAPartirDe: null });
  assert.deepEqual(p, { assinada: true, plano: "Básico", acesso: "ativa", marcas: { usadas: 3, maximo: 5 }, pagoAte: "2026-11-01T00:00:00Z",
    cancelaNoFim: false, soLeituraAPartirDe: null, titular: "dona@agencia.com" });
});

test("a data do só leitura só aparece na tolerância; cancelar no fim só vale para assinatura ativa", () => {
  const base = { plano: { codigo: "basico", nome: "Básico", maximo_de_marcas: null }, marcas: 1 };
  const tolerancia = planoDaConta({ ...base, assinatura: { ...ASSINATURA, situacao: "em_atraso", em_atraso_desde: "2026-10-01T00:00:00Z" }, acesso: "tolerancia", soLeituraAPartirDe: "2026-10-08T00:00:00Z" });
  assert.ok(tolerancia.assinada && tolerancia.soLeituraAPartirDe === "2026-10-08T00:00:00Z");
  const soLeitura = planoDaConta({ ...base, assinatura: { ...ASSINATURA, situacao: "em_atraso", cancelar_no_fim: true }, acesso: "so_leitura", soLeituraAPartirDe: "2026-10-08T00:00:00Z" });
  assert.ok(soLeitura.assinada && soLeitura.soLeituraAPartirDe === null && soLeitura.cancelaNoFim === false);
});

test("o Portal do Stripe só devolve para as Configurações da própria conta", () => {
  assert.equal(voltaDoPortal("https://brennimark.test", "agencia-exemplo"), "https://brennimark.test/w/agencia-exemplo/configuracoes?parte=plano");
  assert.equal(voltaDoPortal("https://brennimark.test", "../../x"), "https://brennimark.test/w/..%2F..%2Fx/configuracoes?parte=plano");
});

test("o Vini em conta só leitura diz por quê, e quem resolve", () => {
  assert.match(mensagemDeOrcamento("conta_so_leitura", false), /assinatura desta conta está em atraso.*só para leitura/);
  assert.match(mensagemDeOrcamento("conta_so_leitura", true), /read-only/);
  assert.doesNotMatch(mensagemDeOrcamento("conta_so_leitura", false), /suporte/);
});

test("o Portal e a situação da cobrança pedem sessão", () => {
  assert.equal(caminhoPublico("/api/cobranca/portal"), false);
  assert.equal(caminhoPublico("/api/cobranca/situacao"), false);
  assert.equal(caminhoPublico("/api/configuracoes/plano"), false);
});
