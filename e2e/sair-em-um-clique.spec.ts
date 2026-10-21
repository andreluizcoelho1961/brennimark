import { expect, test } from "@playwright/test";

/**
 * A saída em UM clique (22/10/2026, RFC 8058): o endereço do cabeçalho
 * `List-Unsubscribe`. Sem sessão. O efeito no banco (parar de receber, e só isso)
 * está provado em `scripts/prova-cadastros-gratuitos.sh`; aqui, a porta: o GET
 * não age, e o POST só age com o corpo exato do provedor.
 */
const TOKEN = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

test("GET não faz nada: leva à página, onde a pessoa escolhe", async ({ request }) => {
  const r = await request.get(`/api/sair/${TOKEN}`, { maxRedirects: 0 });
  expect(r.status()).toBe(303);
  expect(new URL(r.headers().location, "http://x.test").pathname).toBe(`/sair/${TOKEN}`);
});

test("token que não é uuid: 404, sem tocar no banco", async ({ request }) => {
  expect((await request.get("/api/sair/abc", { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.post("/api/sair/abc", { data: "List-Unsubscribe=One-Click", headers: { "content-type": "application/x-www-form-urlencoded" } })).status()).toBe(404);
});

test("POST sem o corpo do provedor é recusado", async ({ request }) => {
  const r = await request.post(`/api/sair/${TOKEN}`, { data: "qualquer=coisa", headers: { "content-type": "application/x-www-form-urlencoded" } });
  expect(r.status()).toBe(400);
  expect((await request.post(`/api/sair/${TOKEN}`)).status()).toBe(400);
});

test("a rota é pública: sem sessão, não vai para o login", async ({ request }) => {
  const r = await request.post(`/api/sair/${TOKEN}`, { data: "qualquer=coisa", headers: { "content-type": "application/x-www-form-urlencoded" }, maxRedirects: 0 });
  expect(r.status()).not.toBe(307);
  expect(r.status()).not.toBe(302);
});
