import { expect, test } from "@playwright/test";

/**
 * A rota de manutenção fecha sem o segredo do Cron (24/09/2026).
 *
 * `/api/manutencao/` passa pelo `proxy` sem sessão — quem a chama é o Vercel
 * Cron. A trava é a própria rota: `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Esta suíte sobe SEM `CRON_SECRET`, que é exatamente o caso perigoso: um
 * servidor com o segredo esquecido não pode aceitar `Bearer undefined`, nem
 * cabeçalho vazio. O 401 vem antes de qualquer cliente Supabase existir.
 */
const ROTA = "/api/manutencao/materiais-orfaos";

for (const [caso, cabecalho] of [
  ["sem cabeçalho", undefined],
  ["Bearer undefined", "Bearer undefined"],
  ["Bearer vazio", "Bearer "],
  ["um segredo qualquer", "Bearer um-segredo-qualquer-com-folga-de-tamanho"],
] as const) {
  test(`sem o segredo configurado, ${caso} recebe 401`, async ({ request }) => {
    const resposta = await request.get(ROTA, {
      headers: cabecalho === undefined ? {} : { Authorization: cabecalho },
      maxRedirects: 0,
    });
    expect(resposta.status()).toBe(401);
  });
}

test("e POST não existe nela", async ({ request }) => {
  const resposta = await request.post(ROTA, { maxRedirects: 0 });
  expect(resposta.status()).toBe(405);
});
