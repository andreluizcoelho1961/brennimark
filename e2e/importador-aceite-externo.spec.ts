import { expect, test } from "@playwright/test";
import { existsSync, statSync } from "node:fs";

/**
 * Aceite com um manual de marca REAL, lido de onde ele mora.
 *
 * O arquivo não entra no repositório e não é copiado para lugar nenhum: ele é
 * material de trabalho, e versionar PDF de cliente é como o produto começou
 * errado da primeira vez.
 *
 * O caminho vem OBRIGATORIAMENTE de BRENNIMARK_ACCEPTANCE_PDF. Não há padrão
 * embutido: um caminho da máquina de quem escreveu o teste é um teste que só
 * roda numa máquina, e pior, um que finge estar rodando em todas as outras.
 * Sem a variável, o teste se pula dizendo o motivo. O CI não a define, e não
 * deve: o manual não está lá e não deveria estar.
 *
 * O que este teste NÃO faz, de propósito: não envia nada ao Storage e não
 * publica marca. Ele exercita a leitura, o agrupamento e a prévia, que é onde
 * um manual de 743 páginas quebra. Publicar exigiria sessão real e deixaria
 * rastro num projeto de produção.
 *
 * Rodar apenas este aceite:
 *   BRENNIMARK_ACCEPTANCE_PDF="/caminho/para/o.pdf" \\
 *     npx playwright test importador-aceite-externo
 */
const CAMINHO = process.env.BRENNIMARK_ACCEPTANCE_PDF ?? "";

const motivoDoPulo = !CAMINHO
  ? "BRENNIMARK_ACCEPTANCE_PDF não está definida: sem manual de aceite, nada a medir."
  : !existsSync(CAMINHO)
    ? `BRENNIMARK_ACCEPTANCE_PDF aponta para um arquivo que não existe: ${CAMINHO}`
    : "";

test.describe("aceite com manual real", () => {
  test.skip(motivoDoPulo !== "", motivoDoPulo);

  test("um manual de centenas de páginas chega à prévia", async ({ page }, info) => {
    test.setTimeout(600_000);

    const bytes = statSync(CAMINHO).size;

    const chamadasDeEscrita: string[] = [];
    page.on("request", (requisicao) => {
      const url = requisicao.url();
      if (/\/storage\/v1\/object|\/rest\/v1\/rpc\//.test(url)) {
        chamadasDeEscrita.push(`${requisicao.method()} ${new URL(url).pathname}`);
      }
    });

    await page.goto("/dev/importar");

    const comeco = Date.now();
    await page.setInputFiles('input[type="file"]', CAMINHO);
    await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible({
      timeout: 540_000,
    });
    const duracaoMs = Date.now() - comeco;

    const metricas = await page.evaluate(() => {
      const texto = document.body.innerText;
      const numero = (padrao: RegExp) => Number(texto.match(padrao)?.[1] ?? 0);
      const memoria = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      return {
        paginas: numero(/(\d+) páginas no PDF/),
        secoes: numero(/·\s*(\d+) seções/),
        semTexto: numero(/·\s*(\d+) sem texto/),
        naTela: document.querySelectorAll("li[data-secao]").length,
        // Só o Chromium expõe isto; nos outros fica nulo, e tudo bem.
        heapMb: memoria ? Math.round(memoria.usedJSHeapSize / 1024 / 1024) : null,
      };
    });

    // As métricas ficam no relatório do teste. Nenhum trecho do manual é
    // registrado: o conteúdo é do cliente, e o que interessa aqui é a escala.
    console.log(
      `[aceite ${info.project.name}] ${JSON.stringify({
        arquivoMib: Math.round((bytes / 1024 / 1024) * 10) / 10,
        duracaoSegundos: Math.round(duracaoMs / 100) / 10,
        ...metricas,
      })}`,
    );

    await info.attach("metricas-do-aceite", {
      contentType: "application/json",
      body: JSON.stringify(
        {
          motor: info.project.name,
          arquivoMib: Math.round((bytes / 1024 / 1024) * 10) / 10,
          duracaoSegundos: Math.round(duracaoMs / 100) / 10,
          ...metricas,
        },
        null,
        2,
      ),
    });

    /*
     * O NÚMERO, e não uma faixa frouxa.
     *
     * A versão anterior afirmava `secoes < paginas`, e 742 satisfaz isso. Em
     * produção o importador estava gerando UMA SEÇÃO POR PÁGINA — 743 — e
     * nenhuma asserção deste arquivo teria pegado, porque todas eram
     * desigualdades largas.
     *
     * Se a heurística mudar de propósito, este número muda junto, no mesmo
     * commit, com o motivo. É essa a intenção: que mexer no agrupamento exija
     * declarar o novo resultado, em vez de deixá-lo passar por dentro de uma
     * faixa.
     */
    expect(metricas.paginas).toBe(743);

    /*
     * 122, e não 152.
     *
     * O número caiu quando o detector de títulos passou a exigir uma palavra
     * de verdade. Trinta das antigas fronteiras eram ESPÉCIMES: páginas de
     * amostra de tipografia, com um "G g" em corpo enorme sobre uma legenda
     * pequena. Elas tinham a maior proporção de destaque da página e viravam
     * seção de uma página cada, chamada pela letra.
     *
     * Mudança deliberada de heurística, com o resultado novo declarado no
     * mesmo commit — que é o contrato deste teste.
     */
    expect(metricas.secoes).toBe(122);

    // Uma seção por página é o defeito nomeado, e merece asserção própria:
    // ela é o estado em que o "manual" vira o índice do PDF.
    expect(
      metricas.secoes,
      "uma seção por página — o agrupamento não aconteceu",
    ).toBeLessThan(metricas.paginas / 2);

    // O teto do produto. Acima dele a RPC recusa a publicação, e a prévia não
    // deve sequer oferecer o botão com um conjunto que o banco recusaria.
    expect(metricas.secoes).toBeLessThanOrEqual(500);

    // A prévia continua paginada: o custo da tela não acompanha o do manual.
    expect(metricas.naTela).toBeLessThanOrEqual(40);

    // Nada saiu da máquina. O botão de publicar está habilitado — a prévia
    // terminou e o fluxo está pronto —, e o que este teste garante é que ele
    // NÃO foi acionado: nenhuma chamada ao Storage nem à função de publicação.
    expect(chamadasDeEscrita, "o aceite não pode publicar nada").toEqual([]);
  });

  test("nenhuma seção nasce de cabeçalho repetido sozinho", async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto("/dev/importar");
    await page.setInputFiles('input[type="file"]', CAMINHO);
    await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible({
      timeout: 540_000,
    });

    for (let i = 0; i < 8; i += 1) {
      const botao = page.getByRole("button", { name: /Carregar mais/ });
      if ((await botao.count()) === 0) break;
      await botao.click();
    }

    const secoes = await page.evaluate(() =>
      [...document.querySelectorAll("li[data-secao]")].map((li) => ({
        titulo: li.querySelector<HTMLInputElement>("[data-titulo]")?.value ?? "",
        faixa: li.querySelector("span.font-mono")?.textContent ?? "",
      })),
    );

    /*
     * O sintoma que apareceu em produção: títulos repetidos, uma página cada,
     * slugs incrementais. É o cabeçalho da página virando título de seção
     * porque a detecção de repetidos não o removeu.
     *
     * A asserção não proíbe título repetido — dois capítulos podem se chamar
     * "Aplicações". Ela proíbe a COMBINAÇÃO: título repetido E faixa de uma
     * página só, que é a assinatura do defeito.
     */
    const porTitulo = new Map<string, number>();
    for (const s of secoes) porTitulo.set(s.titulo, (porTitulo.get(s.titulo) ?? 0) + 1);

    const suspeitas = secoes.filter(
      (s) => (porTitulo.get(s.titulo) ?? 0) > 1 && !s.faixa.includes("–"),
    );
    expect(
      suspeitas.length,
      `${suspeitas.length} seções de uma página com título repetido`,
    ).toBe(0);

    // E toda seção declara a sua procedência: sem faixa, a publicação gravaria
    // documento sem `source_pages`, e a citação diria só "está no manual".
    for (const s of secoes) {
      expect(s.faixa, "seção sem faixa de páginas").toMatch(/\d/);
    }
  });

  test("a busca alcança o manual inteiro", async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto("/dev/importar");
    await page.setInputFiles('input[type="file"]', CAMINHO);
    await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible({
      timeout: 540_000,
    });

    const total = Number(
      (await page.getByText(/Mostrando \d+ de (\d+)/).textContent())?.match(/de (\d+)/)?.[1] ?? 0,
    );
    expect(total).toBeGreaterThan(40);

    // Um termo que não existe precisa devolver zero — se a busca só olhasse o
    // que está na tela, qualquer termo do fim do manual daria zero também, e o
    // teste não distinguiria os dois casos.
    await page.getByPlaceholder(/Buscar por título/).fill("zzzznaoexisteaqui");
    await expect(page.getByText("Nenhuma seção corresponde à busca.")).toBeVisible();
  });
});
