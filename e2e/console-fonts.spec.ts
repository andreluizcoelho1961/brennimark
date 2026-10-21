import { expect, test, type Page } from "@playwright/test";

/**
 * As licenças do Fonts no Console (16/10/2026).
 *
 * `/api/console/fonts` é fingido. Quem pode emitir, o limite de computadores, a
 * validade e o registro estão provados no banco (`scripts/prova-licencas-do-fonts.sh`);
 * a assinatura, na suíte de unidade. Aqui, o caminho da tela: criar com motivo,
 * ativar um computador e receber o arquivo, revogar, e a recusa do servidor
 * aparecendo como foi dita.
 */

const LIC_ATIVA = "11111111-1111-4111-8111-111111111111";
const LIC_VENCIDA = "22222222-2222-4222-8222-222222222222";
const LIC_REVOGADA = "33333333-3333-4333-8333-333333333333";
const ATIV = "44444444-4444-4444-8444-444444444444";
const CODIGO = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const CERTIFICADO = { format: "brennimark-fonts-license-v1", payload: "cGF5bG9hZA", signature: "c2lnbmF0dXJl" };

const futuro = new Date(Date.now() + 80 * 86_400_000).toISOString();
const passado = new Date(Date.now() - 5 * 86_400_000).toISOString();
const base = { titular_email: "ana@exemplo.test", agencia: "", emitida_em: new Date(Date.now() - 10 * 86_400_000).toISOString(), revogada_em: null };

const LICENCAS = [
  { ...base, id: LIC_ATIVA, numero: "BMF-BETA-000001", plano: "individual", max_dispositivos: 2, titular_nome: "Ana Designer", expira_em: futuro,
    ativacoes: [{ id: ATIV, codigo_dispositivo: CODIGO, ativada_em: base.emitida_em, revogada_em: null }] },
  { ...base, id: LIC_VENCIDA, numero: "BMF-BETA-000002", plano: "studio", max_dispositivos: 20, titular_nome: "Bruno Diretor", expira_em: passado, ativacoes: [] },
  { ...base, id: LIC_REVOGADA, numero: "BMF-BETA-000003", plano: "beta", max_dispositivos: 1, titular_nome: "Carla", expira_em: futuro, revogada_em: passado, ativacoes: [] },
];

type Pedido = Record<string, unknown>;

async function fingir(page: Page, enviados: Pedido[], opcoes: { chave?: boolean; resposta?: { status: number; json: unknown } } = {}) {
  await page.route("**/api/console/fonts**", async (rota) => {
    const pedido = rota.request();
    if (pedido.method() === "POST") {
      const corpo = pedido.postDataJSON() as Pedido;
      enviados.push(corpo);
      if (opcoes.resposta) return rota.fulfill(opcoes.resposta);
      if (corpo.acao === "criar") return rota.fulfill({ json: { id: "x", numero: "BMF-BETA-000004", expira_em: futuro } });
      if (corpo.acao === "ativar" || corpo.acao === "certificado") {
        return rota.fulfill({ json: { certificado: CERTIFICADO, arquivo: "brennimark-fonts-BMF-BETA-000001.json", lugares: 2 } });
      }
      return rota.fulfill({ json: { ok: true } });
    }
    return rota.fulfill({ json: { licencas: LICENCAS, chaveConfigurada: opcoes.chave !== false } });
  });
}

test("a lista mostra situação, lugares e validade, e só licença ativa oferece ações", async ({ page }) => {
  await fingir(page, []);
  await page.goto("/dev/console-fonts");

  const ativa = page.locator('[data-licenca="BMF-BETA-000001"]');
  await expect(ativa).toHaveAttribute("data-situacao", "ativa");
  await expect(ativa.locator("[data-lugares]")).toHaveText("1 de 2 computadores");
  await expect(ativa.getByRole("button", { name: "Gerar certificado" })).toBeVisible();

  const vencida = page.locator('[data-licenca="BMF-BETA-000002"]');
  await expect(vencida).toHaveAttribute("data-situacao", "vencida");
  await expect(vencida.getByRole("button")).toHaveCount(0);

  const revogada = page.locator('[data-licenca="BMF-BETA-000003"]');
  await expect(revogada).toHaveAttribute("data-situacao", "revogada");
  await expect(revogada.getByRole("button")).toHaveCount(0);
});

test("criar uma licença manda plano, computadores, validade e motivo", async ({ page }) => {
  const enviados: Pedido[] = [];
  await fingir(page, enviados);
  await page.goto("/dev/console-fonts");

  const form = page.locator("[data-nova-licenca]");
  await form.getByLabel("Plano").selectOption("studio");
  await form.getByLabel("Computadores", { exact: true }).fill("20");
  await form.getByLabel("Nome do testador").fill("Bruno Diretor");
  await form.getByLabel("E-mail").fill("bruno@agencia.test");
  await form.getByLabel("Agência ou estúdio (opcional)").fill("Agência Prova");
  await form.getByLabel("Motivo").fill("convite de 16/10");
  await form.getByRole("button", { name: "Criar licença" }).click();

  await expect(form.getByRole("status")).toContainText("BMF-BETA-000004");
  expect(enviados).toEqual([{
    acao: "criar", plano: "studio", dispositivos: 20, nome: "Bruno Diretor", email: "bruno@agencia.test",
    agencia: "Agência Prova", dias: 90, motivo: "convite de 16/10",
  }]);
});

test("individual não deixa passar de 2 computadores no campo", async ({ page }) => {
  await fingir(page, []);
  await page.goto("/dev/console-fonts");
  const form = page.locator("[data-nova-licenca]");
  await expect(form.getByLabel("Computadores", { exact: true })).toHaveAttribute("max", "2");
  await form.getByLabel("Plano").selectOption("studio");
  await expect(form.getByLabel("Computadores", { exact: true })).toHaveAttribute("max", "1000");
});

test("ativar um computador devolve o certificado para copiar ou baixar", async ({ page }) => {
  const enviados: Pedido[] = [];
  await fingir(page, enviados);
  await page.goto("/dev/console-fonts");

  const ativar = page.locator('[data-acao="ativar-BMF-BETA-000001"]');
  await ativar.getByLabel("Código do computador (tela Sobre do aplicativo)").fill(CODIGO);
  await ativar.getByLabel("Motivo").fill("beta 90 dias");
  await ativar.getByRole("button", { name: "Gerar certificado" }).click();

  expect(enviados).toEqual([{ acao: "ativar", licencaId: LIC_ATIVA, codigo: CODIGO, motivo: "beta 90 dias" }]);
  const certificado = ativar.locator("[data-certificado]");
  await expect(certificado).toBeVisible();
  await expect(certificado.getByLabel("Certificado")).toHaveValue(/"format": "brennimark-fonts-license-v1"/);

  const download = page.waitForEvent("download");
  await certificado.getByRole("button", { name: /Baixar brennimark-fonts-BMF-BETA-000001\.json/ }).click();
  expect((await download).suggestedFilename()).toBe("brennimark-fonts-BMF-BETA-000001.json");
});

test("revogar um computador manda a ativação e o motivo", async ({ page }) => {
  const enviados: Pedido[] = [];
  await fingir(page, enviados);
  await page.goto("/dev/console-fonts");

  const revogar = page.locator(`[data-acao="revogar-${ATIV}"]`);
  await revogar.getByLabel("Motivo").fill("trocou de máquina");
  await revogar.getByRole("button", { name: "Revogar este computador" }).click();
  await expect(revogar.getByRole("status")).toContainText("Feito");
  expect(enviados).toEqual([{ acao: "revogar-ativacao", ativacaoId: ATIV, motivo: "trocou de máquina" }]);
});

test("a recusa do servidor aparece como foi dita, e nenhum certificado é mostrado", async ({ page }) => {
  await fingir(page, [], { resposta: { status: 409, json: { message: "Esta licença já usa todos os computadores. Revogue um para liberar o lugar." } } });
  await page.goto("/dev/console-fonts");

  const ativar = page.locator('[data-acao="ativar-BMF-BETA-000001"]');
  await ativar.getByLabel("Código do computador (tela Sobre do aplicativo)").fill(CODIGO);
  await ativar.getByLabel("Motivo").fill("terceiro computador");
  await ativar.getByRole("button", { name: "Gerar certificado" }).click();
  await expect(ativar.getByRole("status")).toContainText("já usa todos os computadores");
  await expect(ativar.locator("[data-certificado]")).toHaveCount(0);
});

test("sem a chave de assinatura, o painel avisa", async ({ page }) => {
  await fingir(page, [], { chave: false });
  await page.goto("/dev/console-fonts");
  await expect(page.locator("[data-sem-chave]")).toContainText("BRENNIMARK_CHAVE_LICENCAS_FONTS");
});
