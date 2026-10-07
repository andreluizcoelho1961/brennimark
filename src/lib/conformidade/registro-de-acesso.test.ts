import assert from "node:assert/strict";
import test from "node:test";
import { ipDoPedido, marcaDoAcesso, precisaRegistrar } from "./registro-de-acesso";

const cab = (h: Record<string, string>) => ({ get: (n: string) => h[n] ?? null });

test("o IP é o primeiro do x-forwarded-for; lixo não vira registro", () => {
  assert.equal(ipDoPedido(cab({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.equal(ipDoPedido(cab({ "x-real-ip": "198.51.100.4" })), "198.51.100.4");
  assert.equal(ipDoPedido(cab({ "x-forwarded-for": "2001:db8::1" })), "2001:db8::1");
  assert.equal(ipDoPedido(cab({ "x-forwarded-for": "não-é-ip" })), null);
  assert.equal(ipDoPedido(cab({ "x-forwarded-for": "999.1.1.1" })), null);
  assert.equal(ipDoPedido(cab({})), null);
});

test("uma linha por pessoa, por hora e por IP", () => {
  const h = Date.UTC(2026, 9, 7, 15, 0, 0);
  const m = marcaDoAcesso("203.0.113.7", h);
  assert.equal(precisaRegistrar(undefined, m), true);
  assert.equal(precisaRegistrar(m, marcaDoAcesso("203.0.113.7", h + 59 * 60_000)), false);
  assert.equal(precisaRegistrar(m, marcaDoAcesso("203.0.113.7", h + 60 * 60_000)), true);
  assert.equal(precisaRegistrar(m, marcaDoAcesso("203.0.113.8", h)), true);
});
