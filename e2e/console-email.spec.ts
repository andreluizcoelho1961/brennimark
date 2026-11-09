import { expect, test, type Page } from "@playwright/test";

/**
 * O e-mail de marketing no Console (22/10/2026).
 *
 * `/api/console/email` é fingido. Quem pode enviar, quem é elegível, o "uma vez
 * só por campanha" e o registro estão provados no banco
 * (`scripts/prova-envios-de-email.sh`); o texto e o rodapé, na suíte de unidade.
 * Aqui, o caminho da tela: ver o alcance, testar, e só enviar com motivo e
 * depois de um segundo clique.
 */

type Pedido = Record<string, unknown>;

const RESUMO = { elegiveis: 12, alcance: 8, enviados: 3, falhas: 1 };

async function fingir(page: Page, pedidos: Pedido[], opcoes: { configurado?: boolean; envio?: { status: number; json: unknown } } = {}) {
  await page.route("**/api/console/email", async (rota) => {
    const corpo = rota.request().postDataJSON() as Pedido;
    pedidos.push(corpo);
    if (corpo.acao === "resumo") {
      const filtrado = Array.isArray(corpo.cargos) && corpo.cargos.length > 0;
      return rota.fulfill({ json: { resumo: filtrado ? { ...RESUMO, alcance: 2 } : RESUMO, configurado: opcoes.configurado !== false } });
    }
    if (corpo.acao === "teste") return rota.fulfill({ json: { ok: true, para: "andre@exemplo.test" } });
    return rota.fulfill(opcoes.envio ?? { json: { tentados: 5, enviados: 5, falhas: 0 } });
  });
}

test("mostra a campanha, o rodapé legal e os números do alcance", async ({ page }) => {
  await fingir(page, []);
  await page.goto("/dev/console-email");

  await expect(page.locator("[data-previa]")).toContainText("um kit por marca, um clique para ativar");
  await expect(page.locator("[data-previa]")).toContainText("Olá, Ana.");
  await expect(page.locator("[data-previa]")).toContainText("Beta para os 50 primeiros");
  await expect(page.locator("[data-previa]")).toContainText("rodapé legal");
  await expect(page.locator("[data-elegiveis]")).toHaveText("12");
  await expect(page.locator("[data-alcance]")).toHaveText("8");
  await expect(page.locator("[data-enviados]")).toHaveText("3");
  await expect(page.locator("[data-falhas]")).toHaveText("1");
});

test("filtrar por cargo pede o alcance de novo com o filtro", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, pedidos);
  await page.goto("/dev/console-email");
  await expect(page.locator("[data-alcance]")).toHaveText("8");

  await page.getByLabel("Designer", { exact: true }).check();
  await expect(page.locator("[data-alcance]")).toHaveText("2");
  expect(pedidos.at(-1)).toEqual({ acao: "resumo", campanha: "convite-fonts-beta", cargos: ["designer"], equipes: [] });
});

test("o teste vai para o e-mail de quem está logado, sem pedir motivo", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, pedidos);
  await page.goto("/dev/console-email");

  await page.getByRole("button", { name: "Enviar teste para mim" }).click();
  await expect(page.locator("[data-aviso=ok]")).toContainText("andre@exemplo.test");
  expect(pedidos.filter((p) => p.acao === "teste")).toEqual([{ acao: "teste", campanha: "convite-fonts-beta", idioma: "pt-BR" }]);
});

test("o teste em inglês pede o idioma en", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, pedidos);
  await page.goto("/dev/console-email");

  await page.getByRole("button", { name: "Enviar teste em inglês" }).click();
  await expect(page.locator("[data-aviso=ok]")).toContainText("andre@exemplo.test");
  expect(pedidos.filter((p) => p.acao === "teste")).toEqual([{ acao: "teste", campanha: "convite-fonts-beta", idioma: "en" }]);
});

test("enviar exige motivo e um segundo clique, e manda a quantidade escolhida", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, pedidos);
  await page.goto("/dev/console-email");

  const enviar = page.getByRole("button", { name: /Enviar para até/ });
  await expect(enviar).toBeDisabled();

  await page.getByLabel("Quantas agora").fill("5");
  await page.getByLabel(/Motivo/).fill("primeira rodada");
  await expect(enviar).toBeEnabled();
  await enviar.click();

  // O segundo clique: nada foi enviado ainda.
  await expect(page.locator("[data-confirmacao]")).toContainText("Enviar de verdade a 5 pessoas");
  expect(pedidos.filter((p) => p.acao === "enviar")).toHaveLength(0);

  await page.getByRole("button", { name: "Confirmar envio" }).click();
  await expect(page.locator("[data-aviso=ok]")).toContainText("5 de 5 enviados");
  expect(pedidos.filter((p) => p.acao === "enviar")).toEqual([
    { acao: "enviar", campanha: "convite-fonts-beta", cargos: [], equipes: [], limite: 5, motivo: "primeira rodada" },
  ]);
});

test("Cancelar na confirmação não envia nada", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, pedidos);
  await page.goto("/dev/console-email");

  await page.getByLabel(/Motivo/).fill("só olhando");
  await page.getByRole("button", { name: /Enviar para até/ }).click();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.locator("[data-confirmacao]")).toHaveCount(0);
  expect(pedidos.filter((p) => p.acao === "enviar")).toHaveLength(0);
});

test("falhas aparecem como alerta, com a promessa de voltar na próxima rodada", async ({ page }) => {
  await fingir(page, [], { envio: { status: 200, json: { tentados: 5, enviados: 3, falhas: 2 } } });
  await page.goto("/dev/console-email");

  await page.getByLabel(/Motivo/).fill("rodada com falha");
  await page.getByRole("button", { name: /Enviar para até/ }).click();
  await page.getByRole("button", { name: "Confirmar envio" }).click();
  await expect(page.locator("[data-aviso=erro]")).toContainText("3 de 5 enviados, 2 falharam");
});

test("sem o serviço de e-mail ligado, teste e envio ficam desligados e o painel avisa", async ({ page }) => {
  await fingir(page, [], { configurado: false });
  await page.goto("/dev/console-email");

  await expect(page.locator("[data-sem-email]")).toContainText("não está configurado");
  await expect(page.getByRole("button", { name: "Enviar teste para mim" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Enviar para até/ })).toBeDisabled();
});

test("a recusa do servidor aparece como foi dita", async ({ page }) => {
  await fingir(page, [], { envio: { status: 400, json: { message: "Escreva o motivo (de 3 a 500 caracteres): ele fica no registro." } } });
  await page.goto("/dev/console-email");

  await page.getByLabel(/Motivo/).fill("abc");
  await page.getByRole("button", { name: /Enviar para até/ }).click();
  await page.getByRole("button", { name: "Confirmar envio" }).click();
  await expect(page.locator("[data-aviso=erro]")).toContainText("Escreva o motivo");
});
