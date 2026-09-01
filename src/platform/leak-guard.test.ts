import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
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
  "src/components/shell/NavigationDrawer.tsx",
  "src/components/shell/WorkspaceIdentity.tsx",
  "src/components/shell/navigation.ts",
  // A citação é instrumento de governança: ela afirma de onde veio a
  // informação, e não pode vestir a cor de marca nenhuma — nem a do cliente
  // apresentado, nem a de um release antigo.
  "src/components/ai/AssistantMessage.tsx",
];

test("nenhum componente da V2 usa token de release de cliente", () => {
  for (const arquivo of V2) {
    assert.doesNotMatch(lerCodigo(arquivo), /release-analog-/, `${arquivo} nasceu com token legado`);
  }
});

test("nenhum componente da V2 usa alias legado de cor", () => {
  for (const arquivo of V2) {
    assert.doesNotMatch(
      lerCodigo(arquivo),
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

/**
 * Patch 3.3. O adaptador entre a marca do banco e o prompt já foi um ponto
 * cego: statusLabels era opcional no contrato, então esquecê-lo não produzia
 * erro de tipo nem exceção — produzia uma resposta sutilmente errada.
 *
 * O campo passou a ser obrigatório aceitando `undefined`, e agora quem cobra a
 * omissão é o compilador. Esta guarda continua por baixo, porque ela também
 * pega o caso de alguém encaminhar o campo com valor fixo em vez do da marca —
 * o que o tipo não vê. A lista é manual e não descobre um quinto campo
 * sozinha; o tipo descobre.
 */
test("o adaptador encaminha todo o contrato do prompt", () => {
  const contexto = lerCodigo("src/lib/brandville/context.ts");
  const corpo = contexto.slice(contexto.indexOf("export function brandPromptContext"));
  const adaptador = corpo.slice(0, corpo.indexOf("\n}"));

  for (const campo of ["language", "chatRole", "analysisRole", "statusLabels"]) {
    assert.match(adaptador, new RegExp(`${campo}:`), `brandPromptContext não encaminha ${campo}`);
  }
});

test("as fixtures de marcas opostas continuam sendo linhas de banco", () => {
  // Uma fixture que monta o objeto final testaria o componente e não o
  // caminho — foi assim que o adaptador do prompt descartou statusLabels com
  // o CI verde. Elas precisam atravessar parseBrandRow.
  assert.match(lerCodigo("src/app/dev/marcas/page.tsx"), /parseBrandRow/);
  const fixtures = lerCodigo("src/platform/fixtures/marcas-opostas.ts");
  assert.match(fixtures, /status_labels/, "as fixtures usam os nomes de coluna do banco");
});

/**
 * Patch 4.1. Dois estados booleanos que podem ser verdadeiros ao mesmo tempo
 * descrevem uma situação que não deveria existir. A gaveta e a busca eram
 * assim, e ⌘K funciona em qualquer lugar: com a gaveta aberta, o atalho
 * empilhava a busca por cima e a página passava a ter dois diálogos.
 */
test("a moldura mantém um único estado de modal", () => {
  const shell = lerCodigo("src/components/shell/AppShellV2.tsx");
  assert.doesNotMatch(
    shell,
    /useState\(false\)/,
    "estado de modal em booleano permite dois abertos ao mesmo tempo",
  );
  assert.match(shell, /"none" \| "nav" \| "search"/, "um estado, três valores");
});

test("o resto da aplicação fica inerte com um modal aberto", () => {
  // Prender o foco não impede a navegação virtual de leitor de tela.
  assert.match(lerCodigo("src/components/shell/AppShellV2.tsx"), /inert=\{/);
});

test("a moldura declara viewport-fit cover", () => {
  // Sem isso todo env(safe-area-inset-*) do repositório vale zero.
  assert.match(lerCodigo("src/app/layout.tsx"), /viewportFit: "cover"/);
});

/**
 * Patch 4.2. Estado modal não pode depender de largura de tela. A gaveta era
 * escondida por CSS acima de 1024px — e escondida não é fechada: o estado
 * continuava aberto, o resto seguia inerte, e a única coisa capaz de destravar
 * a tela havia sumido.
 */
test("a gaveta não é escondida por breakpoint", () => {
  const gaveta = lerCodigo("src/components/shell/NavigationDrawer.tsx");
  assert.doesNotMatch(
    gaveta,
    /fixed inset-0[^"]*lg:hidden/,
    "esconder o overlay por CSS deixa a aplicação inerte sem caminho para destravar",
  );
});

test("a devolução do foco é da moldura, não de cada modal", () => {
  // Focar elemento inerte não faz nada: quem sabe quando o `inert` saiu é a
  // moldura, e é lá que a origem do foco é guardada e restaurada.
  const shell = lerCodigo("src/components/shell/AppShellV2.tsx");
  assert.match(shell, /origemDoFoco/);
  assert.doesNotMatch(
    lerCodigo("src/components/shell/NavigationDrawer.tsx"),
    /focoAnterior/,
    "dois donos da devolução de foco disputam e o último a rodar vence",
  );
});

/**
 * Patch 4.3. `isConnected` mente: o botão da navegação mobile continua no
 * documento e some acima de 1024px. Devolver o foco para ele depois de uma
 * rotação manda o foco ao corpo, e quem usa teclado perde a posição.
 */
test("a devolução do foco exige elemento com caixa, não só conectado", () => {
  const shell = lerCodigo("src/components/shell/AppShellV2.tsx");
  assert.match(shell, /getClientRects\(\)\.length > 0/, "elemento sem caixa não recebe foco");
  assert.match(shell, /data-nav-active/, "a reserva é o destino ativo da navegação");
  assert.match(shell, /data-shell-main/, "e o conteúdo como último recurso");
});

test("só a moldura devolve o foco", () => {
  // Dois donos disputam e o último a rodar vence — e o que vence pode ser o
  // que não sabe se a origem ainda está visível.
  for (const arquivo of [
    "src/components/shell/CommandPalette.tsx",
    "src/components/shell/NavigationDrawer.tsx",
  ]) {
    assert.doesNotMatch(
      lerCodigo(arquivo),
      /restoreFocusTo|focoAnterior/,
      `${arquivo} devolve o foco por conta própria`,
    );
  }
});

test("os destinos são localizados por marcador, não por texto", () => {
  // Texto de destino é traduzido; um seletor por rótulo quebraria em inglês.
  assert.match(lerCodigo("src/components/shell/DesktopSidebar.tsx"), /data-nav-destination/);
});

/**
 * Patch 4.4. O efeito que devolve o foco também roda na montagem. Sem uma
 * saída explícita, ele cai na cadeia de reserva e a página foca a navegação ou
 * o conteúdo sozinha, assim que carrega.
 */
test("a moldura devolve o foco, mas não o inicializa", () => {
  const shell = lerCodigo("src/components/shell/AppShellV2.tsx");
  assert.match(
    shell,
    /if \(!origem\) return;/,
    "sem origem não houve modal, e restaurar foco não é o mesmo que inicializá-lo",
  );
});

/**
 * Patch 5. Duas interfaces no mesmo produto significam que a que está sendo
 * revisada não é a que as pessoas usam. O DocsNav foi removido; esta guarda
 * impede que um caminho paralelo volte.
 */
test("não existe uma segunda navegação de documentos", () => {
  const componentes = readdirSync(path.join(raiz, "src/components/docs"));
  assert.ok(!componentes.includes("DocsNav.tsx"), "a V1 voltou ao repositório");
  assert.doesNotMatch(
    lerCodigo("src/app/docs/layout.tsx"),
    /DocsNav/,
    "o layout real voltou a montar a V1",
  );
  assert.match(lerCodigo("src/app/docs/layout.tsx"), /AppShellV2/);
});

/**
 * Patch 5.1. A moldura não conhece marca global. Este era o último fio: a
 * seleção das funcionalidades vinha de `brandvilleUtilityLinks`, que lia a
 * instância — e a instância é `unconfigured`, com zero utilidades. A seção
 * "Inteligência" ficava permanentemente vazia, em qualquer marca.
 */
const MOLDURA_SEM_MARCA_GLOBAL = [
  "src/components/shell/navigation.ts",
  "src/components/shell/AppShellV2.tsx",
  "src/components/shell/DesktopSidebar.tsx",
  "src/components/shell/NavigationDrawer.tsx",
  "src/components/shell/PlatformTopBar.tsx",
  "src/components/shell/WorkspaceIdentity.tsx",
];

test("a moldura não importa a configuração global de marca", () => {
  for (const arquivo of MOLDURA_SEM_MARCA_GLOBAL) {
    const codigo = lerCodigo(arquivo);
    for (const proibido of [/brandvilleInstance/, /brandvilleUtilityLinks/, /brandville\/config/]) {
      assert.doesNotMatch(
        codigo,
        proibido,
        `${arquivo} lê a marca de um objeto de módulo em vez da requisição`,
      );
    }
  }
});

test("as funcionalidades chegam por parâmetro", () => {
  const navegacao = lerCodigo("src/components/shell/navigation.ts");
  assert.match(navegacao, /utilityLinks\?: readonly BrandvilleUtilityKey\[\]/);
  // O catálogo é da plataforma; a seleção é da marca.
  assert.match(navegacao, /CATALOGO_DE_UTILIDADES/);
});

test("o layout real passa as funcionalidades da marca resolvida", () => {
  assert.match(
    lerCodigo("src/app/docs/layout.tsx"),
    /utilityLinks: brand\?\.navigation\.utilityLinks/,
    "sem isto a navegação real volta a ficar sem a seção Inteligência",
  );
});

/**
 * O importador. Ele é o caminho que cria conteúdo, então é onde um descuido
 * vira dado errado no banco de um cliente.
 */
test("o importador não usa chave privilegiada", () => {
  for (const arquivo of [
    "src/components/import/BrandImporter.tsx",
    "src/app/docs/importar/page.tsx",
  ]) {
    const codigo = lerCodigo(arquivo);
    assert.doesNotMatch(
      codigo,
      /service_role|SERVICE_ROLE|createServiceClient/,
      `${arquivo} usa credencial privilegiada; a importação corre com a sessão de quem importa`,
    );
  }
});

test("o rascunho nasce rascunho, sem caminho alternativo", () => {
  const rascunho = lerCodigo("src/lib/import/draft.ts");
  assert.match(rascunho, /status: "draft"/);
  // Nenhum outro status pode ser escrito por este módulo.
  assert.doesNotMatch(rascunho, /status: "ready"|status: "pending"/);
});

test("a importação é publicada por RPC, não por escrita solta", () => {
  const importador = lerCodigo("src/components/import/BrandImporter.tsx");
  assert.match(importador, /rpc\("publish_brand_import"/, "marca e documentos entram juntos");
  assert.doesNotMatch(
    importador,
    /from\("brands"\)|from\("brand_documents"\)/,
    "escrita direta escaparia da transação e poderia deixar marca sem conteúdo",
  );
});

test("a rota de importação exige quem administra", () => {
  assert.match(
    lerCodigo("src/app/docs/importar/page.tsx"),
    /capabilities\.includes\("administrar"\)/,
  );
});

/**
 * Patch 5.2. Apagar uma marca é ato total, e o PDF é a cópia mais completa do
 * conteúdo. A cascata do banco não alcança o Storage.
 */
test("a exclusão de marca enfileira os arquivos na mesma transação", () => {
  const rota = lerCodigo("src/app/api/admin/brand/route.ts");
  // Storage primeiro trocava um problema por outro: Storage bem-sucedido com
  // banco falhando deixava a marca viva sem a própria fonte.
  assert.match(rota, /delete_brand_with_files/, "a marca e a fila entram juntas");
  assert.doesNotMatch(
    rota,
    /from\("brands"\)\s*\.delete\(\)/,
    "exclusão solta escapa da transação que registra os arquivos",
  );
});

test("o caminho do arquivo é exclusivo da importação", () => {
  const importador = lerCodigo("src/components/import/BrandImporter.tsx");
  assert.match(
    importador,
    /\$\{workspaceId\}\/\$\{importId\}\/\$\{hash\}\.pdf/,
    "caminho só por conta+hash faz duas marcas compartilharem o objeto",
  );
});

test("o caminho não é enviado pelo cliente", () => {
  // Procedência que o cliente escolhe não é procedência.
  assert.doesNotMatch(
    lerCodigo("src/components/import/BrandImporter.tsx"),
    /p_storage_path:/,
    "a função reconstrói o caminho e confere se o objeto existe",
  );
});

test("nenhuma linha de storage.objects é tocada por SQL", () => {
  // Quem remove é a API do Storage; mexer na tabela deixa o arquivo no disco.
  for (const arquivo of ["src/app/api/admin/brand/route.ts"]) {
    assert.doesNotMatch(lerCodigo(arquivo), /storage\.objects/);
  }
});

test("o upload por hash é imutável", () => {
  const importador = lerCodigo("src/components/import/BrandImporter.tsx");
  assert.match(importador, /upsert: false/, "upsert exigiria política de UPDATE que não existe");
  assert.match(importador, /objetoNovo/, "só remove o arquivo se esta tentativa o criou");
});

test("o idioma do manual não vem do idioma da interface", () => {
  const importador = lerCodigo("src/components/import/BrandImporter.tsx");
  assert.match(importador, /p_language: idiomaDoManual/);
  assert.doesNotMatch(
    importador,
    /p_language: isEnglish/,
    "o idioma de quem importa não é o idioma do PDF",
  );
});

/**
 * Patch 5.4. Uma fila durável que ninguém alcança é só uma tabela crescendo.
 */
test("a exclusão de marca é idempotente e sempre drena", () => {
  const rota = lerCodigo("src/app/api/admin/brand/route.ts");
  assert.match(
    rota,
    /jaNaoExiste/,
    "marca ausente significa exclusão já feita; devolver 404 antes da fila a torna inalcançável",
  );
  assert.match(rota, /export async function POST/, "drenar precisa existir sem apagar nada");
});

test("a administração drena a fila ao abrir", () => {
  assert.match(lerCodigo("src/app/docs/admin/page.tsx"), /drenarFilaDeExclusao/);
});

test("a fila fecha por observação, não pela resposta do Storage", () => {
  const limpeza = lerCodigo("src/lib/import/limpeza.ts");
  // A documentação não define o retorno quando o objeto já não existe, e esse
  // é o caso mais comum numa segunda tentativa.
  assert.match(limpeza, /objetoAusente/);
  assert.match(limpeza, /\.list\(/, "a ausência é verificada, não presumida");
});

test("falha ao limpar uma importação abandonada vira pendência", () => {
  assert.match(
    lerCodigo("src/components/import/BrandImporter.tsx"),
    /enqueue_import_cleanup/,
    "sem isto o caminho só existe no estado da aba e some quando ela fecha",
  );
});

/**
 * O primeiro usuário do produto não pode ficar preso.
 *
 * Sessão sem conta (workspace) era tratada como visitante: a moldura mandava
 * ao login, e o login — vendo que a pessoa tem sessão — mandava de volta.
 * Laço fechado, e o cadastro que criaria a conta era inalcançável.
 */
test("sessão sem conta é distinguida de visitante", () => {
  const contexto = lerCodigo("src/lib/brandville/context.ts");
  assert.match(contexto, /temSessao/, "getAuth nulo não separa os dois casos");
  assert.match(contexto, /"onboarding"/);
});

test("o cadastro fala a língua da interface", () => {
  const cadastro = lerCodigo("src/app/onboarding/page.tsx");
  // Cada rótulo precisa passar pela escolha de idioma. O texto em inglês DENTRO
  // do ternário é legítimo — o que não pode é rótulo solto no JSX.
  for (const rotulo of ["Falta um passo", "Diga quem você é", "Entrou como", "Nome"]) {
    assert.ok(
      cadastro.includes(`t("${rotulo}"`),
      `o cadastro não tem tradução para "${rotulo}"`,
    );
  }
  assert.doesNotMatch(
    cadastro,
    />\s*(One more step|Tell us who you are|Saving…)\s*</,
    "rótulo fixo em inglês, fora da escolha de idioma",
  );
});

/**
 * Um arquivo de teste que não roda é pior que nenhum: ele conta como cobertura
 * e não afirma nada. A suíte listava os arquivos um a um, e `lib/import` nunca
 * entrou na lista — oito testes do importador nunca executaram.
 */
test("a suite descobre os testes, em vez de listá-los", () => {
  const scripts = JSON.parse(ler("package.json")).scripts as Record<string, string>;
  assert.match(scripts["test:brand-context"], /tsconfig\.tests\.json/);
  assert.match(scripts["test:brand-context"], /\*\*\/\*\.test\.js/);
  assert.doesNotMatch(
    scripts["test:brand-context"],
    /src\/lib\/[a-z]+\/[a-z-]+\.test\.ts/,
    "lista explícita deixa arquivo novo de fora sem avisar",
  );
});

/** Todos os .test.ts sob src, por caminho relativo à raiz. */
function testesNaFonte(): string[] {
  const encontrados: string[] = [];
  const pilha = [path.join(raiz, "src")];
  while (pilha.length > 0) {
    const dir = pilha.pop()!;
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = path.join(dir, entrada.name);
      if (entrada.isDirectory()) pilha.push(caminho);
      else if (entrada.name.endsWith(".test.ts")) encontrados.push(caminho);
    }
  }
  return encontrados;
}

/**
 * Fonte, compilado e executado precisam ser o mesmo conjunto.
 *
 * Um .test.ts sem .test.js correspondente é cobertura declarada que nunca
 * roda — foi o que aconteceu com draft.test.ts. Um .test.js sem fonte é o
 * inverso: sobra de uma compilação antiga, que pode passar por engano ou
 * duplicar um resultado. Por isso a suíte apaga o diretório temporário antes
 * de compilar; esta guarda existe caso alguém remova essa limpeza.
 */
test("cada teste na fonte tem um compilado, e vice-versa", () => {
  const fonte = new Set(
    testesNaFonte().map((f) => path.relative(path.join(raiz, "src"), f).replace(/\.ts$/, "")),
  );

  const compilados = new Set<string>();
  const base = path.join(raiz, ".tmp/brand-context-test");
  const pilha = [base];
  while (pilha.length > 0) {
    const dir = pilha.pop()!;
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = path.join(dir, entrada.name);
      if (entrada.isDirectory()) pilha.push(caminho);
      else if (entrada.name.endsWith(".test.js")) {
        compilados.add(path.relative(base, caminho).replace(/\.js$/, ""));
      }
    }
  }

  const semCompilado = [...fonte].filter((f) => !compilados.has(f));
  assert.deepEqual(semCompilado, [], "teste que existe e nunca executa");

  const semFonte = [...compilados].filter((c) => !fonte.has(c));
  assert.deepEqual(semFonte, [], "artefato velho sem fonte: pode mascarar ou duplicar");
});

test("todo teste desta suite importa por caminho relativo", () => {
  // O alias `@/` exige a configuração do Next, que esta compilação não tem.
  // Um teste que use alias falha ao compilar — e a suíte inteira para.
  const arquivos = testesNaFonte();
  assert.ok(arquivos.length > 10, "a varredura precisa achar os testes");
  for (const arquivo of arquivos) {
    assert.doesNotMatch(
      readFileSync(arquivo, "utf8"),
      /^import .* from "@\//m,
      `${path.relative(raiz, arquivo)} usa alias e não compilaria nesta suíte`,
    );
  }
});
