import { expect, test } from "@playwright/test";

/**
 * A tela de entrada só entra — conta de time, fechada (decisão de 17/09/2026).
 *
 * O teste de código-fonte (`leak-guard`) impede que a chamada de cadastro volte;
 * este prova o que a PESSOA vê: nenhuma porta para criar conta, e uma frase
 * dizendo a quem pedir acesso. Sem a frase, quem chega sem conta fica num
 * formulário que recusa a senha dela sem explicar por quê.
 *
 * ⚠️ O portão de verdade é a configuração do projeto no Supabase. Nenhum teste
 * de navegador prova aquilo — está fora do código.
 */
test("não há como criar conta pela tela de entrada", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("button", { name: /criar conta|create account/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^entrar$|^sign in$/i })).toBeVisible();
});

test("a tela diz a quem pedir acesso", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText(/administrador da sua equipe|team's administrator/i)).toBeVisible();
});

test("entrar continua pedindo e-mail e senha", async ({ page }) => {
  await page.goto("/login");

  await expect(page.locator('input[type="email"]')).toBeVisible();
  const senha = page.locator('input[type="password"]');
  await expect(senha).toBeVisible();
  // `current-password`, e não `new-password`: o gerenciador de senhas do
  // navegador não deve oferecer criação de senha numa tela que não cria conta.
  await expect(senha).toHaveAttribute("autocomplete", "current-password");
});
