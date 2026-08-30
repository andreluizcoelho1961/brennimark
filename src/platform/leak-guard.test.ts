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

/**
 * Patch 2. Os caminhos de escrita passaram a se identificar pela marca. As
 * guardas abaixo impedem o retorno de duas fontes de verdade — o registro em
 * código e o par workspace_id + instance_key — que faziam a escrita gravar
 * onde a leitura nova não procura.
 */
const ESCRITA = [
  "src/app/api/admin/content/route.ts",
  "src/app/api/admin/content/history/route.ts",
  "src/app/docs/admin/page.tsx",
];

test("a escrita não consulta o registro em código", () => {
  for (const arquivo of ESCRITA) {
    assert.doesNotMatch(
      lerCodigo(arquivo),
      /activeDocsRegistry|getActiveDocBySlug/,
      `${arquivo} valida conteúdo contra código; a marca vive no banco`,
    );
  }
});

test("a escrita não se identifica por instance_key", () => {
  for (const arquivo of ESCRITA) {
    assert.doesNotMatch(
      lerCodigo(arquivo),
      /eq\("instance_key"|"workspace_id,instance_key,slug"/,
      `${arquivo} grava ou consulta pelo par antigo; a chave é brand_id`,
    );
  }
});

test("a administração não veste a marca por instância global", () => {
  assert.doesNotMatch(
    lerCodigo("src/app/docs/admin/page.tsx"),
    /brandvilleInstance/,
    "as seções válidas são as da marca resolvida",
  );
});

test("o rótulo do histórico vem do vocabulário, não de comparação solta", () => {
  const historico = lerCodigo("src/components/admin/VersionHistory.tsx");
  assert.match(historico, /historyActionLabel/);
  assert.doesNotMatch(
    historico,
    /action === "restored_to_matrix"/,
    "comparar com um único valor faz qualquer ação nova virar 'Publicada'",
  );
});

/**
 * Patch 2.1. A recuperação de uma página excluída é o caminho mais fácil de
 * quebrar sem perceber: ele só é exercido depois de alguém apagar algo.
 */
test("o histórico não exige que a página ainda exista", () => {
  const rota = lerCodigo("src/app/api/admin/content/history/route.ts");
  assert.doesNotMatch(
    rota,
    /if \(!contexto\.docs\.some\(\(doc\) => doc\.slug === slug\)\)/,
    "validar o slug contra as páginas vivas torna a recuperação inalcançável justamente quando é necessária",
  );
});

test("a recuperação grava os blocos de volta", () => {
  const rota = lerCodigo("src/app/api/admin/content/history/route.ts");
  assert.match(rota, /blocks: snapshot\.blocks/, "sem isto a página renasce sem conteúdo estruturado");
});

test("a administração oferece as páginas excluídas", () => {
  // Recuperação que existe na API e não na tela não existe para ninguém.
  assert.match(lerCodigo("src/app/docs/admin/page.tsx"), /getDeletedPages/);
  assert.match(lerCodigo("src/components/admin/AdminPanel.tsx"), /deletedPages/);
});

test("as rotas de laboratório continuam fechadas em produção", () => {
  // Elas servem dados fixos e existem para o teste de navegador. Uma delas
  // aberta em produção seria conteúdo falso servido como se fosse da marca.
  for (const rota of [
    "src/app/dev/shell-v2/[[...slug]]/page.tsx",
    "src/app/dev/admin-panel/page.tsx",
  ]) {
    const codigo = lerCodigo(rota);
    assert.match(codigo, /NODE_ENV === "production"/, `${rota} não verifica o ambiente`);
    assert.match(codigo, /notFound\(\)/, `${rota} não fecha a porta`);
  }
});

/**
 * Patch 3. O idioma da interface é do produto e de quem usa; o idioma do
 * manual é da marca. Eram a mesma coisa em 33 pontos.
 *
 * Duas exceções deliberadas, e só duas:
 *
 * - o selo de status, cujo vocabulário a marca declara e pode redefinir:
 *   traduzi-lo diria na tela algo diferente do que a marca aprovou;
 * - o prompt do assistente, que cita o manual e responde sobre ele.
 */
const FALAM_A_LINGUA_DO_PRODUTO = [
  "src/components/shell/navigation.ts",
  "src/components/shell/PlatformTopBar.tsx",
  "src/components/shell/CommandPalette.tsx",
  "src/components/docs/DocsNav.tsx",
  "src/components/docs/DocPage.tsx",
  "src/components/admin/AdminPanel.tsx",
  "src/components/admin/VersionHistory.tsx",
  "src/components/assets/AssetLibrary.tsx",
  "src/components/ai/AIRoutingPanel.tsx",
  "src/components/ai/AssistantMessage.tsx",
  "src/components/analysis/FeedbackPanel.tsx",
  "src/app/layout.tsx",
  "src/app/login/page.tsx",
  "src/app/docs/analise/page.tsx",
  "src/app/docs/chat/page.tsx",
  "src/app/docs/historico/page.tsx",
  "src/app/docs/biblioteca/page.tsx",
  "src/app/docs/configuracoes/ia/page.tsx",
  "src/app/api/admin/content/route.ts",
  "src/app/api/ai/chat/route.ts",
  "src/lib/ai/errors.ts",
];

test("nenhum instrumento do produto decide microcópia pelo idioma do manual", () => {
  for (const arquivo of FALAM_A_LINGUA_DO_PRODUTO) {
    assert.doesNotMatch(
      lerCodigo(arquivo),
      /metadata\.language/,
      `${arquivo} fala a língua do manual; um manual em inglês não muda o login de ninguém`,
    );
  }
});

test("o selo de status recebe o vocabulário da marca, sem buscá-lo", () => {
  const selo = lerCodigo("src/components/docs/StatusBadge.tsx");
  assert.match(selo, /statusLabels/, "o vocabulário editorial chega por propriedade");
  assert.doesNotMatch(selo, /brandvilleInstance/, "e não de um objeto global de processo");
});

test("resolveInterfaceLocale não aceita o idioma do manual", () => {
  // A ausência é o ponto: se houvesse um parâmetro de marca, alguém acabaria
  // passando brand.metadata.language para cá.
  assert.doesNotMatch(lerCodigo("src/platform/locale.ts"), /brand|manual\.language/i);
});

/**
 * Patch 3.1. O módulo do assistente é o mais perigoso do repositório para
 * herança: o texto vai direto para o modelo, ninguém o revisa em runtime, e um
 * nome de cor esquecido lá dentro julga todas as marcas.
 */
test("o prompt não conhece marca global nem registro em código", () => {
  const modulo = lerCodigo("src/lib/ai/brand-context.ts");
  assert.doesNotMatch(modulo, /brandvilleInstance/, "idioma e papéis chegam por parâmetro");
  assert.doesNotMatch(
    modulo,
    /activeDocsRegistry/,
    "um valor padrão vindo do registro faz um chamador esquecido montar prompt sem marca",
  );
});

test("nenhuma cor de cliente sobrevive no prompt universal", () => {
  const modulo = lerCodigo("src/lib/ai/brand-context.ts");
  for (const termo of [/Turquoise/i, /turquesa/i, /release-analog/, /hairline/i, /bluesmaker/i]) {
    assert.doesNotMatch(modulo, termo, `o prompt de análise carrega vocabulário de um cliente: ${termo}`);
  }
});

test("as funções de prompt exigem a marca, sem cair em padrão", () => {
  const modulo = lerCodigo("src/lib/ai/brand-context.ts");
  // Assinatura com valor padrão foi como a instância global sobreviveu até
  // aqui: o chamador não passava nada e o módulo escolhia por ele.
  assert.doesNotMatch(modulo, /docs: readonly DocPageEntry\[\] =/);
  for (const fn of ["buildChatSystemPrompt", "buildAnalysisSystemPrompt"]) {
    const trecho = modulo.slice(modulo.indexOf(`export function ${fn}`));
    assert.match(trecho.slice(0, 200), /brand: BrandPromptContext/, `${fn} precisa receber a marca`);
  }
});

/**
 * Patch 3.2. Uma segunda tabela de status é o começo de duas verdades: a tela
 * mostra um termo, o assistente cita outro, e a pessoa não sabe se está vendo
 * a mesma página. Havia exatamente isso — o prompt trazia a sua própria tabela
 * e ignorava o vocabulário que a marca declara.
 */
test("o prompt não mantém tabela de status própria", () => {
  const modulo = lerCodigo("src/lib/ai/brand-context.ts");
  for (const termo of [/"PRONTO"/, /"RASCUNHO"/, /"EM CONSTRUÇÃO"/, /"READY"/, /"DRAFT"/, /"IN PROGRESS"/]) {
    assert.doesNotMatch(modulo, termo, `rótulo de status fixo no prompt: ${termo}`);
  }
  assert.match(
    modulo,
    /resolveStatusLabels/,
    "o vocabulário precisa vir da mesma função que a interface usa",
  );
});

test("o reconhecimento de citação não tem vocabulário fixo", () => {
  const modulo = lerCodigo("src/lib/ai/citations.ts");
  for (const termo of [/PRONTO\|/, /READY\|/, /STATUS_PATTERN/]) {
    assert.doesNotMatch(modulo, termo, "uma marca com rótulo próprio não seria reconhecida");
  }
});

test("nenhum nome de seção de cliente sobrou no reconhecimento de citação", () => {
  // Havia uma tabela traduzindo ids técnicos para "Guia de Cores", "Símbolos e
  // Logotipos", "Tom de Voz" — as seções do manual de um cliente, no núcleo.
  const modulo = lerCodigo("src/lib/ai/citations.ts");
  assert.doesNotMatch(modulo, /SOURCE_TITLES|Guia de Cores|Símbolos e Logotipos|Tom de Voz/);
});
