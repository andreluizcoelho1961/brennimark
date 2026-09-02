import { expect, test } from "@playwright/test";

/**
 * O que a marca NÃO contratou não existe — nem no menu, nem por URL.
 *
 * Vem do primeiro ciclo autenticado: a marca importada apareceu com Chat,
 * Análise, Histórico e Configurações apesar de nenhuma caixa ter sido marcada.
 * O contrato precisa ser inequívoco: `[]` significa nenhuma, em todo ponto.
 *
 * O G1 fechou as ROTAS DE API por `utilityLinks`. As PÁGINAS continuaram
 * abertas: quem digitasse o endereço via a tela montada — campo, botão,
 * histórico vazio — de algo que a marca não contratou, e a recusa só chegava
 * quando a API respondia. Uma tela que existe promete o que o servidor vai
 * negar.
 */
const SEM_UTILIDADES = "/dev/marcas?marca=sobria";
const COM_UTILIDADES = "/dev/marcas?marca=festival";

const UTILIDADES = ["chat", "analise", "historico", "configuracoes/ia"] as const;

test("marca sem utilidades não mostra nenhuma na navegação", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SEM_UTILIDADES);
  await expect(page.locator("[data-shell-ready]")).toHaveCount(1);

  const destinos = await page.evaluate(() =>
    [...document.querySelectorAll("[data-nav-destination]")].map((a) => a.getAttribute("href") ?? ""),
  );
  for (const u of ["chat", "analise", "historico", "configuracoes"]) {
    expect(destinos.some((d) => d.includes(u)), `${u} apareceu no menu`).toBe(false);
  }

  // E a seção não aparece VAZIA: cabeçalho sem nada embaixo é ruído que ocupa
  // a altura de um item útil.
  await expect(page.getByRole("heading", { name: /Inteligência|Intelligence/ })).toHaveCount(0);
});

test("marca com utilidades mostra as que contratou", async ({ page }) => {
  // O contraponto: sem ele, o teste acima passaria com a navegação quebrada.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(COM_UTILIDADES);
  await expect(page.locator("[data-shell-ready]")).toHaveCount(1);
  const destinos = await page.evaluate(() =>
    [...document.querySelectorAll("[data-nav-destination]")].map((a) => a.getAttribute("href") ?? ""),
  );
  expect(destinos.some((d) => d.includes("chat"))).toBe(true);
});

for (const utilidade of UTILIDADES) {
  test(`${utilidade} não abre por URL numa marca que não contratou`, async ({ page }) => {
    const resposta = await page.goto(`/w/conta/b/marca/docs/${utilidade}`);
    // 404: a funcionalidade não existe NESTA marca, e dizer isso é a verdade.
    // 403 revelaria a diferença entre "não contratada" e "não é do seu papel".
    expect(resposta?.status(), `${utilidade} respondeu ${resposta?.status()}`).toBe(404);

    // E não é a tela da funcionalidade com um aviso: é a página de ausência.
    await expect(page.getByRole("textbox")).toHaveCount(0);
  });
}
