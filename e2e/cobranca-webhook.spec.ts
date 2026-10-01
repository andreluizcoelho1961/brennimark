import { expect, test } from "@playwright/test";
import Stripe from "stripe";

/**
 * O webhook do Stripe recusa aviso forjado (cobrança, fatia 1, 01/10/2026).
 *
 * É por esta rota que a conta paga nasce, e ela passa pelo `proxy` sem sessão.
 * A única trava é a assinatura do aviso: quem inventasse um "pagamento
 * confirmado" ganharia uma conta. A suíte sobe com um segredo FALSO
 * (`playwright.config.ts`) e prova que só o aviso assinado com ele passa.
 *
 * O aviso bem assinado chega até o banco — e, como a suíte não tem chave de
 * serviço, para em 503. O 503 é a prova de que a assinatura passou.
 */
const ROTA = "/api/cobranca/stripe";
const SEGREDO_DA_SUITE = "whsec_falso_da_suite";
const corpo = JSON.stringify({ id: "evt_suite", type: "invoice.paid", data: { object: {} } });

test("sem assinatura, 400 — e nada de redirecionar ao login", async ({ request }) => {
  const r = await request.post(ROTA, { data: corpo, headers: { "content-type": "application/json" }, maxRedirects: 0 });
  expect(r.status()).toBe(400);
});

test("assinado com outro segredo, 400", async ({ request }) => {
  const r = await request.post(ROTA, {
    data: corpo, maxRedirects: 0,
    headers: { "content-type": "application/json", "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: corpo, secret: "whsec_de_quem_forjou" }) },
  });
  expect(r.status()).toBe(400);
});

test("assinatura certa sobre corpo trocado, 400", async ({ request }) => {
  const forjado = corpo.replace("invoice.paid", "checkout.session.completed");
  const r = await request.post(ROTA, {
    data: forjado, maxRedirects: 0,
    headers: { "content-type": "application/json", "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: corpo, secret: SEGREDO_DA_SUITE }) },
  });
  expect(r.status()).toBe(400);
});

test("bem assinado, passa da assinatura e só para na falta da chave de serviço", async ({ request }) => {
  const r = await request.post(ROTA, {
    data: corpo, maxRedirects: 0,
    headers: { "content-type": "application/json", "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: corpo, secret: SEGREDO_DA_SUITE }) },
  });
  expect(r.status()).toBe(503);
});

test("GET não existe", async ({ request }) => {
  const r = await request.get(ROTA, { maxRedirects: 0 });
  expect(r.status()).toBe(405);
});
