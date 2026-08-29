import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Guarda contra regressão de vazamento visual.
 *
 * Um componente da moldura não pode referenciar token batizado com o nome de um
 * release de cliente (`release-analog-*`), nem decidir comportamento a partir da
 * identidade da instância (`brandvilleInstance.key ===`), nem ler token da marca.
 *
 * `src/platform/tokens.ts` fica de fora de propósito: ele É a camada de
 * compatibilidade, e centralizar ali os nomes legados num lugar só é justamente
 * o que permite removê-los dos componentes.
 *
 * As listas crescem a cada fatia migrada. Cobrem o que já foi migrado — não são
 * promessa sobre o que ainda não foi.
 */
const MOLDURA = [
  "src/components/docs/StatusBadge.tsx",
  "src/components/docs/status.ts",
  "src/components/shell/PlatformSurface.tsx",
];

/** O boundary da marca: pode falar de tokens da marca, mas não de um cliente. */
const BOUNDARY = ["src/components/BrandCanvas.tsx"];

// O teste roda a partir do diretório compilado em .tmp, então __dirname não
// aponta para a raiz. npm executa o script a partir da raiz do repositório.
const raiz = process.cwd();
const ler = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

/** Igual a `ler`, sem comentários. Documentar o que foi removido é legítimo;
 *  o que a guarda persegue é código. */
const lerCodigo = (rel: string) =>
  ler(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("nenhum componente migrado usa token com nome de release de cliente", () => {
  for (const arquivo of [...MOLDURA, ...BOUNDARY]) {
    assert.doesNotMatch(ler(arquivo), /release-analog-/, `${arquivo} ainda usa release-analog-*`);
  }
});

test("nenhum componente migrado decide por identidade de instância", () => {
  for (const arquivo of [...MOLDURA, ...BOUNDARY]) {
    assert.doesNotMatch(
      ler(arquivo),
      /brandvilleInstance\.key\s*===/,
      `${arquivo} ramifica por instância; isso é conteúdo, não regra de produto`,
    );
  }
});

test("a moldura não lê tokens da marca", () => {
  for (const arquivo of MOLDURA) {
    assert.doesNotMatch(
      ler(arquivo),
      /--brand-|bg-brand-|text-brand-|border-brand-/,
      `${arquivo} lê token da marca; governança usa a linguagem da plataforma`,
    );
  }
});

test("o selo de status pinta o próprio fundo de plataforma", () => {
  assert.match(ler("src/components/docs/status.ts"), /bg-platform-panel/);
});

/** Componentes da V2. Nenhum pode nascer com dependência do vocabulário legado. */
const V2 = [
  "src/components/shell/AppShellV2.tsx",
  "src/components/shell/PlatformTopBar.tsx",
  "src/components/shell/DesktopSidebar.tsx",
  "src/components/shell/WorkspaceIdentity.tsx",
  "src/components/shell/navigation.ts",
];

test("nenhum componente da V2 usa token de release de cliente", () => {
  for (const arquivo of V2) {
    assert.doesNotMatch(ler(arquivo), /release-analog-/, `${arquivo} nasceu com token legado`);
  }
});

test("nenhum componente da V2 usa alias legado de cor", () => {
  for (const arquivo of V2) {
    assert.doesNotMatch(
      ler(arquivo),
      /(bg|text|border)-(surface|background|release)-|text-text-secondary/,
      `${arquivo} usa alias legado; a V2 fala --platform-* diretamente`,
    );
  }
});

test("a V2 não veste a marca nem ramifica por instância", () => {
  for (const arquivo of V2) {
    assert.doesNotMatch(ler(arquivo), /--brand-|bg-brand-|text-brand-/, `${arquivo} veste a marca`);
    assert.doesNotMatch(ler(arquivo), /brandvilleInstance\.key\s*===/, `${arquivo} ramifica por instância`);
  }
});

test("a rota de laboratório é fechada em produção", () => {
  const rota = ler("src/app/dev/shell-v2/[[...slug]]/page.tsx");
  assert.match(rota, /NODE_ENV === "production"/);
  assert.match(rota, /notFound\(\)/);
});

test("a V2 não tem texto de interface fixo em um idioma", () => {
  for (const arquivo of V2) {
    const fonte = ler(arquivo);
    // Rótulo visível precisa passar por escolha de idioma, não literal solto.
    const literaisSuspeitos = fonte.match(/>\s*(Buscar|Search|Configurações|Settings)\s*</g);
    assert.equal(literaisSuspeitos, null, `${arquivo} tem rótulo fixo: ${literaisSuspeitos?.join(", ")}`);
  }
});

/**
 * Patch 1. Estes arquivos resolvem ou exibem a marca ativa, e a marca ativa
 * pertence à requisição. Importar `brandvilleInstance` aqui devolveria um
 * objeto global por processo — a marca de uma conta apareceria para outra sob
 * concorrência, e o defeito só se manifestaria com duas contas simultâneas.
 */
const CAMINHO_DA_MARCA = [
  "src/components/BrandCanvas.tsx",
  "src/components/shell/WorkspaceIdentity.tsx",
  "src/lib/brandville/context.ts",
  "src/lib/brandville/workspace-context.ts",
  "src/app/docs/page.tsx",
  "src/app/docs/[...slug]/page.tsx",
  "src/app/docs/layout.tsx",
  "src/app/layout.tsx",
];

test("o caminho da marca ativa não importa a instância global", () => {
  for (const arquivo of CAMINHO_DA_MARCA) {
    assert.doesNotMatch(
      ler(arquivo),
      /^\s*import\s.*brandvilleInstance.*$/m,
      `${arquivo} lê a marca de um objeto de módulo; a marca ativa é da requisição`,
    );
  }
});

test("nenhum código decide comportamento por hasBrand", () => {
  // `hasBrand` era constante calculada da instância estática na inicialização
  // do processo: uma marca podia existir no banco e a interface continuar
  // mostrando o estado vazio. Foi removida; esta guarda impede que volte.
  for (const arquivo of CAMINHO_DA_MARCA) {
    assert.doesNotMatch(lerCodigo(arquivo), /\bhasBrand\b/, `${arquivo} voltou a usar hasBrand`);
  }
});

test("os metadados da aplicação são do produto, não do manual", () => {
  const codigo = lerCodigo("src/app/layout.tsx");
  assert.match(codigo, /platformIdentity/, "o título da aba precisa vir da plataforma");
  assert.doesNotMatch(
    codigo,
    /brandvilleInstance\.metadata/,
    "a marca do cliente não batiza a janela do Brennimark",
  );
});

/**
 * Patch 1.1. Guardas de texto para o que o teste de comportamento não alcança:
 * quem chama o quê. Elas complementam os contadores de context.test.ts — não
 * substituem, porque casar uma string prova ausência de chamada, não correção.
 */
test("o layout de /docs não autentica por conta própria", () => {
  const codigo = lerCodigo("src/app/docs/layout.tsx");
  assert.doesNotMatch(
    codigo,
    /getBrandvilleAuthContext/,
    "o layout autenticava e o contexto autenticava de novo: duas idas à Auth API",
  );
  assert.doesNotMatch(codigo, /from\("profiles"\)/, "o perfil pertence à resolução da requisição");
});

test("a consulta de documentos não descobre a marca", () => {
  const servidor = lerCodigo("src/lib/brandville/server.ts");
  const corpo = servidor.slice(servidor.indexOf("export async function getBrandDocs"));
  assert.doesNotMatch(
    corpo.slice(0, corpo.indexOf("export async function getProfileSummary")),
    /resolveActiveBrand/,
    "getBrandDocs recebe brandId; resolver a marca de novo faz navegação e conteúdo divergirem",
  );
});

test("não voltou um caminho paralelo de documento por slug", () => {
  // getResolvedBrandDoc refazia autenticação, marca e documentos fora do
  // contexto da requisição. Foi removida no patch 1.1.
  assert.doesNotMatch(lerCodigo("src/lib/brandville/server.ts"), /getResolvedBrandDoc\b/);
});

test("nenhum papel é presumido quando não há sessão", () => {
  const codigo = lerCodigo("src/lib/brandville/context.ts");
  assert.doesNotMatch(
    codigo,
    /\?\?\s*"member"/,
    "presumir member dá `consultar` a visitante sem sessão",
  );
});
