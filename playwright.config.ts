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
 * Hermética por construção: o servidor sobe com BRENNIMARK_DEV_SKIP_AUTH, que
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

  /**
   * Três motores, e não é excesso: o leitor de PDF é o ponto do produto onde
   * eles mais divergem — worker, `import.meta`, criptografia, `crypto.subtle`.
   * Um manual que abre no Chrome e falha no Safari é um manual que não abre
   * para metade dos designers.
   *
   * Só a suíte do importador roda nos três. O resto da interface é HTML e CSS
   * comuns; rodar tudo em triplicado triplicaria o tempo do CI sem responder a
   * nenhuma pergunta nova.
   */
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "webkit-importador",
      use: { ...devices["Desktop Safari"] },
      testMatch: /(importador|navegacao-do-manual|limites-de-erro|utilidades-contratadas|importador-payload).*\.spec\.ts/,
    },
    {
      name: "firefox-importador",
      use: { ...devices["Desktop Firefox"] },
      testMatch: /(importador|navegacao-do-manual|limites-de-erro|utilidades-contratadas|importador-payload).*\.spec\.ts/,
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORTA}`,
    url: `http://localhost:${PORTA}/docs`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Só aqui. Nunca em .env, nunca na Vercel — o build de produção falha
      // de propósito se esta variável estiver ligada.
      BRENNIMARK_DEV_SKIP_AUTH: "true",
      // Sem marca: é o estado real do produto antes do primeiro manual.
      NEXT_PUBLIC_BRANDVILLE_INSTANCE: "",

      /*
       * Credenciais FALSAS, e é isso que torna a suíte hermética de verdade.
       *
       * O comentário no topo deste arquivo já dizia "hermética por construção",
       * e não era: sem estas linhas o servidor herdava o `.env.local` da
       * máquina e criava um cliente apontando para o projeto REAL. Localmente
       * os testes passavam; no CI, que não tem `.env.local`, o cliente nem era
       * construído e os testes que chegam até ele quebravam.
       *
       * Uma suíte que passa numa máquina e falha na outra não é suíte. E a
       * dependência era invisível justamente porque funcionava aqui.
       *
       * Nenhuma requisição sai: os testes que exercitam Storage e RPC
       * interceptam a rede. A URL precisa ser válida na forma, não alcançável.
       */
      NEXT_PUBLIC_SUPABASE_URL: "https://projeto-de-teste.supabase.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "chave-de-teste-sem-valor",
    },
  },
});
