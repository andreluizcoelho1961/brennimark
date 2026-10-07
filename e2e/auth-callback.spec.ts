import { expect, test, type Page } from "@playwright/test";

/**
 * O link de e-mail abre a sessão (07/10/2026). Os links gerados pelo servidor
 * (primeiro acesso no Console, "Esqueci a senha") trazem a sessão no
 * fragmento; o cliente do `@supabase/ssr` força PKCE e a recusava em silêncio,
 * e o link caía em /login?error=auth_failed. Aqui o servidor de autenticação
 * é fingido: o que se prova é que a tela entrega o token a ele e segue — ou
 * volta ao login quando ele recusa.
 */
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const TOKEN = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-0000-0000-000000000001", exp: Math.floor(Date.now() / 1000) + 3600, aud: "authenticated", role: "authenticated", email: "fulana@agencia.com" })}.assinatura`;
const USUARIO = { id: "00000000-0000-0000-0000-000000000001", aud: "authenticated", role: "authenticated", email: "fulana@agencia.com", app_metadata: {}, user_metadata: {}, created_at: "2026-10-07T00:00:00Z" };

async function fingir(page: Page, aceita: boolean, vistos: string[]) {
  await page.route("**/auth/v1/user**", (rota) => {
    vistos.push(rota.request().headers()["authorization"] ?? "");
    return aceita ? rota.fulfill({ json: USUARIO }) : rota.fulfill({ status: 401, json: { code: 401, msg: "invalid JWT" } });
  });
  await page.route("**/rest/v1/profiles**", (rota) => rota.fulfill({ json: { id: USUARIO.id, full_name: "Fulana" } }));
}

test("o link com a sessão no fragmento abre a sessão e segue para o destino", async ({ page }) => {
  const vistos: string[] = [];
  await fingir(page, true, vistos);
  // Destino estático: a página real da nova senha consultaria o servidor de
  // autenticação pelo lado do servidor, que a suíte não tem.
  await page.goto(`/auth/callback?next=${encodeURIComponent("/termos")}#access_token=${TOKEN}&expires_in=3600&refresh_token=rt&token_type=bearer&type=recovery`);
  await expect(page).toHaveURL(/\/termos$/, { timeout: 15_000 });
  expect(vistos).toContain(`Bearer ${TOKEN}`);
});

test("token recusado pelo servidor de autenticação: volta ao login com o aviso", async ({ page }) => {
  const vistos: string[] = [];
  await fingir(page, false, vistos);
  await page.goto(`/auth/callback#access_token=${TOKEN}&refresh_token=rt&type=recovery`);
  await expect(page).toHaveURL(/\/login\?error=auth_failed/, { timeout: 15_000 });
});
