import { defineConfig, devices } from "@playwright/test";

/**
 * Suíte de navegador.
 *
 * Existe porque quatro das garantias que o produto precisa dar — ausência de
 * overflow horizontal, sidebar fora do mobile, foco preso no drawer, isolamento
 * visual entre marcas — não são verificáveis sem um layout de verdade. O
 * runner de unidade compila TypeScript e roda asserções; ele nunca vai saber
 * quantos pixels a página tem.
 *
 * Hermética por construção: o servidor sobe com BRANDVILLE_DEV_SKIP_AUTH, que
 * curto-circuita o middleware antes de qualquer cliente Supabase existir. Sem
 * rede, sem banco, sem segredo. Ver src/lib/supabase/middleware.ts.
 *
 * Sem comparação de imagem pixel a pixel nesta fase: ela quebra com mudança de
 * fonte do sistema e vira ruído que se aprende a ignorar. As asserções são
 * estruturais, de geometria e de comportamento.
 */
const PORTA = 3210;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artefatos",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: `http://localhost:${PORTA}`,
    // Guardar só o que ajuda a entender uma falha. Execução verde não deixa
    // rastro: artefato de teste que passou é lixo que ninguém abre.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: `npm run dev -- --port ${PORTA}`,
    url: `http://localhost:${PORTA}/docs`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Só aqui. Nunca em .env, nunca na Vercel — o build de produção falha
      // de propósito se esta variável estiver ligada.
      BRANDVILLE_DEV_SKIP_AUTH: "true",
      // Sem marca: é o estado real do produto antes do primeiro manual.
      NEXT_PUBLIC_BRANDVILLE_INSTANCE: "",
    },
  },
});
