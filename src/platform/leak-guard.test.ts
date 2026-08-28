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
