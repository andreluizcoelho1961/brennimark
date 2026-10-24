import { expect, type Page } from "@playwright/test";

/**
 * Abre a administração de bancada e espera ela LIGAR, não carregar.
 *
 * Medido em 14/10/2026, depois de um teste da paleta estourar 30 s na suíte
 * inteira (#122): `goto` espera o evento `load`, e o servidor de
 * DESENVOLVIMENTO pede um segundo script do cliente de HMR depois da
 * hidratação. Esse script, que o teste não usa, segura o `load`; atrasado
 * 30 s, o teste estoura. Em produção ele não existe.
 *
 * Esperar só o HTML (`commit`), porém, não basta: clicando ou digitando antes
 * da hidratação, o gesto se perde — o CI já concatenou um valor digitado ao
 * corpo inicial assim. `data-admin-editor-ready` nasce num efeito
 * do `AdminPanel`, depois que a árvore inteira tem os handlers.
 *
 * O prazo de 25 s cabe no teste de 30 s: com todo script atrasado 9 s, o
 * marcador chegou em 18,6 s.
 */
export async function abrirAdministracao(page: Page, caminho = "/dev/admin-panel") {
  await page.goto(caminho, { waitUntil: "commit" });
  await expect(page.locator("[data-admin-editor-ready]"))
    .toHaveAttribute("data-admin-editor-ready", "true", { timeout: 25_000 });
}
