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

/** Todos os arquivos de uma pasta, recursivamente, em caminho relativo. */
function listarArquivos(rel: string): string[] {
  const absoluto = path.join(raiz, rel);
  return readdirSync(absoluto, { withFileTypes: true }).flatMap((entrada) => {
    const filho = path.join(rel, entrada.name);
    return entrada.isDirectory() ? listarArquivos(filho) : [filho];
  });
}

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
  /**
   * O visualizador do documento-fonte é o caso mais afiado da fronteira:
   * a moldura cerca a página do CLIENTE, e as duas ficam encostadas na tela.
   * Um botão de zoom que herdasse a cor da marca faria o instrumento do
   * produto parecer parte do manual — e um manual de fundo preto e um de fundo
   * bege precisam da mesma barra.
   */
  "src/components/documento-fonte/VisualizadorDePdf.tsx",
  "src/components/documento-fonte/PaginaDoPdf.tsx",
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

/**
 * Toda bancada de desenvolvimento fecha em produção.
 *
 * A lista cresce junto com as bancadas — uma rota de laboratório que vaza para
 * produção não quebra nada, e é justamente por isso que ninguém percebe: ela
 * fica lá, alcançável por quem souber a URL, mostrando dado de cliente numa
 * tela que nunca passou por revisão de produto.
 */
/**
 * TODAS as bancadas, e não uma lista escrita à mão.
 *
 * Até 13/09/2026 esta guarda listava duas rotas. Existiam oito, todas com a
 * trava — mas por hábito, não por garantia: a lista não conhecia as seis
 * restantes, e a nona nasceria descoberta. Uma guarda que só olha onde alguém
 * lembrou de apontar não é guarda; é um comentário que roda.
 *
 * O gatilho foi concreto: ao acrescentar `/dev/biblioteca` na mesma sessão,
 * nenhum teste teria reclamado se eu tivesse esquecido a trava.
 */
function bancadas(): string[] {
  return listarArquivos("src/app/dev").filter(
    (arquivo) => arquivo.endsWith("page.tsx") || arquivo.endsWith("route.ts"),
  );
}

/**
 * O relatório de conformidade não desenha evidência sem conferir.
 *
 * A função `conferirEvidencia` tem teste próprio; o que esta guarda protege é a
 * LIGAÇÃO dela com o relatório. Sem isso, alguém remove a chamada numa
 * refatoração e os testes de unidade continuam verdes sobre uma função que
 * ninguém chama — e o PDF volta a afirmar que a imagem é a analisada.
 */
test("o relatório confere a evidência antes de desenhá-la", () => {
  const rota = lerCodigo("src/app/api/analysis/history/[id]/report/route.ts");
  assert.match(rota, /conferirEvidencia\(/, "o relatório desenha a evidência sem conferir");
  assert.match(
    rota,
    /image_fingerprint/,
    "a conferência precisa do campo gravado na análise",
  );
});

/**
 * Toda rota de histórico passa pelo portão da utilidade.
 *
 * A tela do histórico já exigia `podeUsar(..., "history")` no layout; as rotas
 * não exigiam nada além de alcançar a marca, e quem chamasse
 * `/api/analysis/history*` direto recebia JSON, URL assinada e PDF numa marca
 * que não contratou a utilidade (achado 4 do Codex Security, 15/09/2026).
 *
 * Varredura, e não lista: a rota do relatório foi acrescentada depois da de
 * lista, e uma lista escrita à mão não a teria conhecido — o mesmo defeito que
 * a guarda das bancadas tinha.
 */
test("as rotas de histórico exigem a utilidade contratada", () => {
  const rotas = listarArquivos("src/app/api/analysis").filter((a) => a.endsWith("route.ts"));
  assert.ok(rotas.length >= 3, `só ${rotas.length} rotas de histórico — a varredura quebrou?`);

  for (const rota of rotas) {
    const codigo = lerCodigo(rota);
    assert.match(
      codigo,
      /contextoDoHistorico|portaoDeIA/,
      `${rota} resolve a marca sem passar pelo portão da utilidade`,
    );
    // O atalho que a correção removeu: resolver só sessão/conta/marca.
    assert.doesNotMatch(
      codigo,
      /getAnalysisAuthContext\(/,
      `${rota} voltou a usar o contexto sem portão`,
    );
  }
});

/**
 * Não existe cadastro público — decisão do André, 17/09/2026.
 *
 * A guarda é no código-fonte porque o caminho de volta é fácil: basta alguém
 * reintroduzir uma aba "criar conta". O portão de verdade é a configuração do
 * projeto no Supabase; esta guarda impede que o produto volte a OFERECER o
 * cadastro, que é o que fazia qualquer visitante virar administrador de uma
 * conta nova (o gatilho `handle_new_profile` cria conta para todo perfil novo).
 */
test("a tela de entrada não oferece cadastro", () => {
  const login = lerCodigo("src/app/login/page.tsx");
  assert.doesNotMatch(login, /auth\.signUp\(/, "a tela de entrada voltou a criar conta");
  assert.doesNotMatch(login, /Criar conta|Create account/, "a tela de entrada voltou a oferecer cadastro");
  assert.match(login, /administrador|administrator/, "a tela precisa dizer a quem pedir acesso");
});

test("as rotas de laboratório são fechadas em produção", () => {
  const rotas = bancadas();
  // Sem isto, apagar a pasta faria o laço não rodar e o teste passar vazio.
  assert.ok(rotas.length >= 8, `só ${rotas.length} bancadas encontradas — a varredura quebrou?`);

  for (const arquivo of rotas) {
    const rota = lerCodigo(arquivo);
    assert.match(rota, /NODE_ENV === "production"/, `${arquivo} não fecha em produção`);
    assert.match(rota, /notFound\(\)/, `${arquivo} não chama notFound`);
  }
});

test("a V2 não tem texto de interface fixo em um idioma", () => {
  for (const arquivo of V2) {
    const fonte = ler(arquivo);
    // Rótulo visível precisa passar por escolha de idioma, não literal solto.
    const entreTags = fonte.match(/>\s*(Buscar|Search|Configurações|Settings)\s*</g);
    assert.equal(entreTags, null, `${arquivo} tem rótulo fixo: ${entreTags?.join(", ")}`);

    /**
     * O furo que esta linha fecha, encontrado em 09/09/2026: a guarda só via
     * rótulo ENTRE TAGS. Um `placeholder="Buscar"` ou um
     * `aria-label="Tela cheia"` passavam limpos — e são texto de interface
     * igual, com o agravante de o `aria-label` ser lido justamente por quem
     * depende dele.
     */
    const emAtributo = fonte.match(
      /(placeholder|aria-label|title|alt)="[^"]*[À-ÿ][^"]*"/g,
    );
    assert.equal(
      emAtributo,
      null,
      `${arquivo} tem texto de interface fixo em atributo: ${emAtributo?.join(", ")}`,
    );
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
  "src/app/w/[workspaceSlug]/b/[brandKey]/docs/page.tsx",
  "src/app/w/[workspaceSlug]/b/[brandKey]/docs/[...slug]/page.tsx",
  "src/app/w/[workspaceSlug]/b/[brandKey]/docs/layout.tsx",
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
  const codigo = lerCodigo("src/app/w/[workspaceSlug]/b/[brandKey]/docs/layout.tsx");
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
  "src/app/w/[workspaceSlug]/b/[brandKey]/docs/admin/page.tsx",
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
    lerCodigo("src/app/w/[workspaceSlug]/b/[brandKey]/docs/admin/page.tsx"),
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
  assert.match(lerCodigo("src/app/w/[workspaceSlug]/b/[brandKey]/docs/admin/page.tsx"), /getDeletedPages/);
  assert.match(lerCodigo("src/components/admin/AdminPanel.tsx"), /deletedPages/);
});

test("as rotas de laboratório continuam fechadas em produção", () => {
  // Elas servem dados fixos e existem para o teste de navegador. Uma delas
  // aberta em produção seria conteúdo falso servido como se fosse da marca.
  for (const rota of [
    ...bancadas(),
    // A rota que falha de propósito para exercitar a fronteira de erro. Aberta
    // em produção, ela seria um jeito de derrubar a tela de qualquer marca.
    // Ela NÃO vive em `src/app/dev`, então continua nomeada aqui.
    "src/app/w/[workspaceSlug]/b/[brandKey]/docs/dev-falha/page.tsx",
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
  "src/app/w/[workspaceSlug]/b/[brandKey]/docs/analise/page.tsx",
  "src/app/w/[workspaceSlug]/b/[brandKey]/docs/chat/page.tsx",
  "src/app/w/[workspaceSlug]/b/[brandKey]/docs/historico/page.tsx",
  "src/app/w/[workspaceSlug]/b/[brandKey]/docs/biblioteca/page.tsx",
  "src/app/w/[workspaceSlug]/b/[brandKey]/docs/configuracoes/ia/page.tsx",
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
    lerCodigo("src/app/w/[workspaceSlug]/b/[brandKey]/docs/layout.tsx"),
    /DocsNav/,
    "o layout real voltou a montar a V1",
  );
  assert.match(lerCodigo("src/app/w/[workspaceSlug]/b/[brandKey]/docs/layout.tsx"), /AppShellV2/);
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
    lerCodigo("src/app/w/[workspaceSlug]/b/[brandKey]/docs/layout.tsx"),
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
    "src/app/w/[workspaceSlug]/importar/page.tsx",
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
    lerCodigo("src/app/w/[workspaceSlug]/importar/page.tsx"),
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
  // O caminho saiu do componente e foi para o módulo de caminhos no M2 — um
  // lugar só monta caminho de Storage. O que a guarda verifica aqui é que ele
  // NÃO voltou a ser montado à mão; a forma do caminho, e a razão dela
  // (conta+hash sozinhos fariam duas marcas compartilharem o objeto), está
  // contada por comportamento em lib/storage/caminhos.test.ts.
  const importador = lerCodigo("src/components/import/BrandImporter.tsx");
  assert.match(importador, /caminhoDeImportacao\(/);
  assert.doesNotMatch(importador, /\$\{workspaceId\}\//);
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
  // `upsert: false` mudou de arquivo quando a sequência de envio saiu do
  // componente para `orfaos.ts` (com teste) e o adaptador do Supabase para
  // `portas-supabase.ts`. A guarda segue o código: o invariante é do UPLOAD,
  // não do componente, e afrouxá-la para o arquivo antigo deixaria de proteger
  // qualquer coisa.
  const portas = lerCodigo("src/lib/import/portas-supabase.ts");
  assert.match(portas, /upsert: false/, "upsert exigiria política de UPDATE que não existe");

  const importador = lerCodigo("src/components/import/BrandImporter.tsx");
  assert.match(importador, /objetoNovo/, "só remove o arquivo se esta tentativa o criou");
});

test("nenhum objeto provisório fica sem destino quando a importação falha", () => {
  /*
   * A guarda do item 2: as imagens de página sobem ANTES de a marca existir,
   * então um retorno antecipado sem limpeza deixa arquivo de terceiro no
   * bucket sem nada no banco apontando para ele — fora do alcance até da fila
   * de exclusão.
   *
   * O importador não pode voltar a chamar `remove` direto: a decisão precisa
   * passar por `garantirAusencia`, que confirma a saída por observação e
   * enfileira o que não saiu.
   */
  const importador = lerCodigo("src/components/import/BrandImporter.tsx");
  assert.match(importador, /enviarArquivosDaImportacao/, "o envio precisa passar pela sequência com limpeza");
  assert.match(importador, /garantirAusencia/, "a limpeza pós-RPC precisa ser durável, não melhor esforço");
  assert.doesNotMatch(
    importador,
    /storage\s*\.from\("brand-assets"\)\s*\.remove/,
    "remoção de asset sem observação nem fila é o defeito que o item 2 corrigiu",
  );
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
  assert.match(lerCodigo("src/app/w/[workspaceSlug]/b/[brandKey]/docs/admin/page.tsx"), /drenarFilaDeExclusao/);
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

test("a pendência que a fila recusa deixa rastro", () => {
  const importador = lerCodigo("src/components/import/BrandImporter.tsx");
  // Chamar a RPC com `await` solto descarta o erro. Foi assim que um 42P10 em
  // toda chamada deixou PDFs fora do Storage limpo e fora da fila, sem registro.
  assert.doesNotMatch(
    importador,
    /^\s*await\s+supabase\.rpc\(\s*"enqueue_import_cleanup"/m,
    "o resultado de enqueue_import_cleanup precisa ser guardado e conferido",
  );
  assert.match(
    importador,
    /const\s+(\w+)\s*=\s*await\s+supabase\.rpc\(\s*"enqueue_import_cleanup"[\s\S]*?if\s*\(\s*\1\.error\s*\)[\s\S]{0,300}?relatarObjetoSemDestino\([\s\S]{0,200}?sqlstate/,
    "falha ao enfileirar precisa virar rastro, com o SQLSTATE",
  );
});

/**
 * O rastro precisa chegar a um log que alguém lê.
 *
 * O importador é componente de tela: um `console.error` dele fica no navegador
 * de quem importou e some quando a aba fecha. A primeira versão do rastro (PR
 * #22) era exatamente isso — melhor que o silêncio, mas fora de qualquer log
 * consultável. Agora todo arquivo sem destino passa pelo ajudante, que também
 * avisa a rota do servidor.
 */
test("todo arquivo sem destino é relatado ao servidor, não só ao console", () => {
  const importador = lerCodigo("src/components/import/BrandImporter.tsx");
  assert.doesNotMatch(
    importador,
    /importacao_deixou_objeto_sem_destino/,
    "o importador não escreve o rastro direto no console: use relatarObjetoSemDestino",
  );
  // As três origens do importador passam pelo ajudante.
  for (const origem of ["envio", "fila", "imagens"]) {
    assert.match(
      importador,
      new RegExp(`relatarObjetoSemDestino\\(\\{\\s*origem:\\s*"${origem}"`),
      `a origem ${origem} precisa passar por relatarObjetoSemDestino`,
    );
  }

  const ajudante = lerCodigo("src/lib/import/relatar-rastro.ts");
  assert.match(ajudante, /"\/api\/importacao\/rastro"/, "o ajudante avisa a rota do servidor");
  assert.match(ajudante, /keepalive/, "sem keepalive o aviso morre quando a aba fecha");
  // O teto do keepalive é de 64 KiB em BYTES, somados entre os pedidos em voo:
  // contar caminhos não mede isso.
  assert.match(ajudante, /TextEncoder/, "os lotes são medidos em bytes UTF-8");
  assert.match(ajudante, /ORCAMENTO_KEEPALIVE_BYTES/, "o keepalive tem orçamento para a soma dos lotes");

  const rota = lerCodigo("src/app/api/importacao/rastro/route.ts");
  assert.match(rota, /auth\.getUser\(\)/, "o ator do rastro vem da sessão validada");
  assert.doesNotMatch(rota, /createServiceClient/, "registrar log não precisa da chave de serviço");
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

/**
 * Um componente de servidor que importa um VALOR de um módulo `"use client"`
 * não recebe o valor: recebe uma referência de cliente, e ler uma propriedade
 * dela devolve `undefined`.
 *
 * O efeito foi silencioso e grave: os limites da importação viravam undefined,
 * e `tamanho > undefined` é sempre falso — os dois limites deixavam de existir.
 * Um PDF de 1.001 páginas passava direto pelo teto de 1.000.
 */
test("rotas de servidor não importam constantes de módulos de cliente", () => {
  const clientes = new Set<string>();
  const pilha = [path.join(raiz, "src")];
  while (pilha.length > 0) {
    const dir = pilha.pop()!;
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = path.join(dir, entrada.name);
      if (entrada.isDirectory()) pilha.push(caminho);
      else if (/\.tsx?$/.test(entrada.name)) {
        if (/^["']use client["']/m.test(readFileSync(caminho, "utf8"))) {
          clientes.add(path.relative(path.join(raiz, "src"), caminho).replace(/\.tsx?$/, ""));
        }
      }
    }
  }

  const servidores = [
    "src/app/dev/importar/page.tsx",
    "src/app/w/[workspaceSlug]/importar/page.tsx",
    "src/app/w/[workspaceSlug]/b/[brandKey]/docs/admin/page.tsx",
    "src/app/w/[workspaceSlug]/b/[brandKey]/docs/layout.tsx",
  ];

  for (const arquivo of servidores) {
    const codigo = lerCodigo(arquivo);
    for (const linha of codigo.match(/^import \{[^}]*\} from "@\/[^"]+";$/gm) ?? []) {
      const modulo = linha.match(/from "@\/([^"]+)"/)?.[1];
      if (!modulo || !clientes.has(modulo)) continue;
      const nomes = linha.match(/\{([^}]*)\}/)?.[1] ?? "";
      for (const nome of nomes.split(",").map((n) => n.trim()).filter(Boolean)) {
        if (nome.startsWith("type ")) continue;
        assert.ok(
          // Componente: PascalCase, digito permitido (AppShellV2).
          /^[A-Z][A-Za-z0-9]*$/.test(nome),
          `${arquivo} importa "${nome}" de ${modulo}, que é módulo de cliente: ` +
            "só componentes atravessam essa fronteira; um valor vira undefined",
        );
      }
    }
  }
});

/**
 * M1. As guardas do contexto ativo.
 *
 * O defeito que elas impedem não dá erro: ele responde. Com duas marcas
 * alcançáveis, `.limit(1)` devolvia uma delas — e a tela ficava certa. Só
 * ficava certa para a marca errada.
 */
test("nenhuma consulta decide workspace pela primeira linha", () => {
  const arquivos = [
    "src/lib/brandville/server.ts",
    "src/lib/ai/settings.ts",
    "src/lib/analysis/server.ts",
  ];
  for (const arquivo of arquivos) {
    const codigo = lerCodigo(arquivo);
    // Cada `from("workspace_members")` seguido de um limite é a assinatura
    // exata do defeito: "quantos workspaces você tem? um, o primeiro".
    const consultas = codigo.split('from("workspace_members")').slice(1);
    for (const consulta of consultas) {
      const trecho = consulta.slice(0, 400);
      assert.doesNotMatch(
        trecho,
        /\.limit\(/,
        `${arquivo}: limitar workspace_members transforma "participa de dois" em "participa de um"`,
      );
    }
  }
});

test("a marca ativa não vem de variável de ambiente", () => {
  const codigo = lerCodigo("src/lib/brandville/server.ts");
  assert.doesNotMatch(
    codigo,
    /NEXT_PUBLIC_BRANDVILLE_INSTANCE/,
    "escolher marca por variável de build amarra um processo a um cliente e exige rebuild para trocar",
  );
});

test("a regra de seleção não conhece Supabase, React nem ambiente", () => {
  // Se ela conhecesse, deixaria de ser verificável sem subir a aplicação — e
  // é a regra que decide qual cliente aparece na tela.
  const codigo = lerCodigo("src/lib/brandville/selecao.ts");
  for (const proibido of ["supabase", "process.env", 'from "react"']) {
    assert.ok(!codigo.includes(proibido), `selecao.ts não deve conhecer ${proibido}`);
  }
});

/**
 * M1.2. Nenhum link sai do contexto da marca.
 *
 * Guarda de código e não de navegador: no preview local não existe capacidade,
 * logo nenhum destino é renderizado, e um teste que percorresse os links da
 * página passaria percorrendo uma lista vazia.
 *
 * O que ela impede: um `href="/docs/historico"` dentro de uma tela da marca.
 * Ele não quebra — leva ao resolvedor, que escolhe uma marca e continua. A
 * pessoa clica em "histórico" dentro da marca A e chega ao histórico da marca
 * B, sem nenhum sinal de que trocou.
 */
test("as telas da marca não usam endereços absolutos de /docs", () => {
  const arquivos = [
    ...listarArquivos("src/app/w"),
    ...listarArquivos("src/components"),
  ].filter((caminho) => /\.tsx?$/.test(caminho) && !caminho.includes(".test."));

  const infratores: string[] = [];
  for (const caminho of arquivos) {
    const codigo = lerCodigo(caminho);
    // `navigation.ts` é a exceção declarada: os destinos ali são canônicos por
    // construção e traduzidos por `withBase` na renderização.
    if (caminho.endsWith("navigation.ts")) continue;
    for (const linha of codigo.split("\n")) {
      if (/href=["'{`]?\/docs/.test(linha) || /router\.push\(["'`]\/docs/.test(linha)) {
        infratores.push(`${caminho}: ${linha.trim().slice(0, 90)}`);
      }
    }
  }
  assert.deepEqual(infratores, [], "link absoluto sai da marca aberta e cai no resolvedor");
});

/**
 * M2. Assets, análise e exportação não conhecem a instância global.
 *
 * `brandvilleInstance` é resolvido uma vez na inicialização do processo, a
 * partir de uma variável de build. Num produto multimarca, cada leitura dele
 * num caminho de conteúdo é uma marca escolhida por outra pessoa em outro
 * momento — e nestes caminhos o resultado sai do produto: um arquivo listado,
 * uma URL assinada, um PDF entregue ao cliente.
 */
const CAMINHOS_DE_CONTEUDO = [
  "src/app/api/assets/route.ts",
  "src/app/api/admin/assets/route.ts",
  "src/app/api/analysis/history/route.ts",
  "src/app/api/analysis/history/[id]/route.ts",
  "src/app/api/analysis/history/[id]/report/route.ts",
  "src/app/api/ai/analyze/route.ts",
  "src/lib/analysis/server.ts",
  "src/lib/analysis/history.ts",
];

test("nenhum caminho de assets, análise ou exportação lê a instância global", () => {
  for (const arquivo of CAMINHOS_DE_CONTEUDO) {
    assert.doesNotMatch(
      lerCodigo(arquivo),
      /brandvilleInstance|brandville\/config/,
      `${arquivo} decide por instância de build, não pela marca da requisição`,
    );
  }
});

test("nenhum caminho de conteúdo consulta por instance_key", () => {
  // A coluna saiu de brand_assets no M2.0. Uma consulta por ela agora falha —
  // mas falharia em produção, na primeira listagem, e não aqui.
  for (const arquivo of CAMINHOS_DE_CONTEUDO) {
    assert.doesNotMatch(lerCodigo(arquivo), /instance_key/, `${arquivo} ainda usa instance_key`);
  }
});

test("toda consulta de conteúdo filtra por marca, não só por conta", () => {
  // A regressão que isto impede: `.eq("workspace_id", ...)` sozinho. Numa
  // conta com quatro marcas, ele devolve o conteúdo das quatro — e a tela
  // mostra tudo como se fosse da marca aberta.
  for (const arquivo of CAMINHOS_DE_CONTEUDO) {
    const codigo = lerCodigo(arquivo);
    const porConta = (codigo.match(/\.eq\("workspace_id"/g) ?? []).length;
    const porMarca = (codigo.match(/\.eq\("brand_id"/g) ?? []).length;
    assert.ok(
      porMarca >= porConta,
      `${arquivo}: ${porConta} filtro(s) por conta e só ${porMarca} por marca`,
    );
  }
});

test("caminho de Storage sai do módulo de caminhos, não de literal", () => {
  // Um template literal montando caminho é como a chave da marca entrou no
  // caminho da primeira vez. Centralizar é o que permite garantir que só
  // identificadores imutáveis apareçam ali.
  for (const arquivo of [...CAMINHOS_DE_CONTEUDO, "src/components/import/BrandImporter.tsx"]) {
    const codigo = lerCodigo(arquivo);
    for (const linha of codigo.split("\n")) {
      assert.doesNotMatch(
        linha,
        /`\$\{[^`]*\}\/\$\{[^`]*\}\/[^`]*`/,
        `${arquivo} monta caminho à mão: ${linha.trim().slice(0, 70)}`,
      );
    }
  }
});

/**
 * A1. A IA não recebe o manual inteiro.
 *
 * O defeito não dava erro: dava resposta, e resposta correta. Ele aparecia na
 * fatura e na latência, e piorava exatamente nos manuais grandes — os que mais
 * precisam de ajuda.
 */
const CAMINHOS_DE_IA = [
  "src/app/api/ai/chat/route.ts",
  "src/app/api/ai/analyze/route.ts",
];

test("nenhuma rota de IA passa os documentos direto para o prompt", () => {
  for (const arquivo of CAMINHOS_DE_IA) {
    const codigo = lerCodigo(arquivo);
    assert.doesNotMatch(
      codigo,
      /(buildChatSystemPrompt|buildAnalysisSystemPrompt)\(\s*(contexto\.)?docs\b/,
      `${arquivo} envia o manual inteiro em vez dos trechos recuperados`,
    );
    assert.match(codigo, /buscarTrechos\(/, `${arquivo} não recupera nada`);
  }
});

test("a busca sempre recebe o brand_id da requisição", () => {
  // A função do banco é `security invoker` e exige `p_brand_id`. O que esta
  // guarda impede é a chamada passar outra coisa — o workspace, por exemplo,
  // que compila igual e devolve vazio para sempre sem ninguém notar.
  const codigo = lerCodigo("src/lib/ai/buscar.ts");
  assert.match(codigo, /p_brand_id: brandId/);
  assert.doesNotMatch(codigo, /p_brand_id: workspace/i);
});

test("os limites de IA vivem num lugar só", () => {
  // Espalhados, viram números mágicos que ninguém revisa junto e o orçamento
  // de uma requisição deixa de ser legível de uma vez.
  const codigo = lerCodigo("src/lib/ai/recuperacao.ts");
  for (const limite of [
    "maxTrechos", "maxCaracteresPorTrecho", "maxCaracteresDeContexto",
    "maxCaracteresDaPergunta", "maxMensagens", "maxCaracteresPorMensagem",
  ]) {
    assert.match(codigo, new RegExp(`${limite}:\\s*\\d`), `${limite} sem valor explícito`);
  }
});

test("não existe conversor de páginas para trechos no código de produção", () => {
  // Ele seria o caminho por onde o manual inteiro voltaria ao prompt: bastaria
  // uma chamada `buildChatSystemPrompt(converter(docs), ...)`. No teste existe
  // um, de propósito — lá é fixture, não atalho.
  const codigo = lerCodigo("src/lib/ai/recuperacao.ts") + lerCodigo("src/lib/ai/buscar.ts");
  assert.doesNotMatch(codigo, /DocPageEntry/, "há conversão de documento para trecho em produção");
});

/**
 * A1.2. Falha da base de conhecimento não vira afirmação sobre o conteúdo.
 *
 * "Não há diretriz documentada para isso" é uma afirmação sobre o MANUAL. O
 * produto só pode fazê-la depois de consultar o manual. Se o banco, a RLS ou a
 * RPC falharam, ele não consultou nada — e dizer que a marca não documentou
 * seria inventar um fato sobre o cliente a partir de um erro de rede.
 *
 * É a mesma classe do defeito do perfil, onde engolir o erro do Supabase fazia
 * uma falha de infraestrutura virar "esta pessoa não completou o cadastro".
 */
test("a busca não engole o erro do banco", () => {
  const codigo = lerCodigo("src/lib/ai/buscar.ts");
  // `return []` depois de um erro é exatamente a regressão. O tipo de retorno
  // discriminado é o que impede o chamador de confundir os dois casos.
  assert.doesNotMatch(codigo, /if \(error\)[\s\S]{0,200}return \[\]/);
  assert.match(codigo, /ok: false/);
});

test("erro de recuperação interrompe antes do provedor de IA", () => {
  for (const arquivo of CAMINHOS_DE_IA) {
    const codigo = lerCodigo(arquivo);

    const posicaoDaGuarda = codigo.indexOf("if (!recuperacao.ok)");
    assert.ok(posicaoDaGuarda > 0, `${arquivo} não interrompe quando a busca falha`);

    // A guarda precisa vir ANTES de qualquer coisa que gaste o provedor:
    // resolver roteamento já lê configuração, e `streamText` é a chamada.
    for (const depois of ["streamText(", "prepareStreamWithFallback("]) {
      const posicao = codigo.indexOf(depois);
      assert.ok(
        posicao === -1 || posicao > posicaoDaGuarda,
        `${arquivo}: ${depois} acontece antes da guarda — o modelo seria acionado sem o manual`,
      );
    }
  }
});

test("a indisponibilidade tem código próprio, distinto de ausência de evidência", () => {
  for (const arquivo of CAMINHOS_DE_IA) {
    const codigo = lerCodigo(arquivo);
    assert.match(codigo, /knowledge_unavailable/, `${arquivo} não nomeia a indisponibilidade`);
    assert.match(codigo, /status: 503/, `${arquivo} não responde 503`);
  }
});

test("o log da falha não carrega conteúdo do manual", () => {
  // A mensagem do Postgres pode conter fragmento da consulta e, por ela, texto
  // do cliente. Log é lido por gente que não deveria ver o manual de ninguém.
  const codigo = lerCodigo("src/lib/ai/buscar.ts");
  const log = codigo.slice(codigo.indexOf("console.error"), codigo.indexOf("return { ok: false"));
  assert.doesNotMatch(log, /error\.message/, "a mensagem do banco vai para o log");
  assert.doesNotMatch(log, /consulta|pergunta/, "a pergunta vai para o log");
});

/**
 * G1. A matriz de papéis vale no servidor, não só no menu.
 *
 * A navegação esconde o link de quem não pode. Esconder um link não fecha uma
 * rota: quem souber a URL chega nela igual, e o `fetch` de um script chega sem
 * nem passar pela navegação.
 */
test("chat e análise passam pelo portão, e por utilidades diferentes", () => {
  const chat = lerCodigo("src/app/api/ai/chat/route.ts");
  const analise = lerCodigo("src/app/api/ai/analyze/route.ts");

  assert.match(chat, /portaoDeIA\(request, "chat"\)/);
  assert.match(analise, /portaoDeIA\(request, "analysis"\)/);
  // Contratar o chat não contrata a análise. Se as duas rotas pedissem a mesma
  // utilidade, uma marca que contratou só o assistente responderia análises.
  assert.doesNotMatch(analise, /portaoDeIA\(request, "chat"\)/);
});

test("o portão vem antes do provedor, nas duas rotas", () => {
  for (const arquivo of CAMINHOS_DE_IA) {
    const codigo = lerCodigo(arquivo);
    const portao = codigo.indexOf("portaoDeIA(");
    assert.ok(portao > 0, `${arquivo} não tem portão`);
    for (const gasto of ["streamText(", "prepareStreamWithFallback(", "buscarTrechos("]) {
      const posicao = codigo.indexOf(gasto);
      assert.ok(
        posicao === -1 || posicao > portao,
        `${arquivo}: ${gasto} acontece antes do portão`,
      );
    }
  }
});

test("as rotas de chave e roteamento exigem quem administra", () => {
  // A RLS já recusa a escrita, mas recusa em silêncio: um update sem linhas
  // afetadas parece sucesso, e a tela diria "salvo" sobre algo que não foi.
  for (const arquivo of [
    "src/app/api/ai/settings/route.ts",
    "src/app/api/ai/settings/[id]/route.ts",
    "src/app/api/ai/routing/route.ts",
  ]) {
    const codigo = lerCodigo(arquivo);
    assert.match(codigo, /donoDaRota\(/, `${arquivo} aceita qualquer membro`);
    assert.doesNotMatch(
      codigo,
      /await workspaceDaRota\(/,
      `${arquivo} ainda resolve sem exigir papel`,
    );
  }
});

test("o teste de conexão não é uma chamada paga lateral", () => {
  const codigo = lerCodigo("src/app/api/ai/test-connection/route.ts");
  const portao = codigo.indexOf("marcaDaRota(request)");
  const papel = codigo.indexOf('contexto.papel !== "owner"');
  const validacao = codigo.indexOf("validarConfiguracaoDoTeste(body)");
  const orcamento = codigo.indexOf("testarConexaoComOrcamento({");
  const provedor = codigo.indexOf("streamText({");

  assert.ok(portao > 0, "o teste não resolve conta e marca no servidor");
  assert.ok(papel > portao, "um member consegue testar uma chave paga");
  assert.ok(validacao > papel, "a chave chega à validação antes do papel");
  assert.ok(orcamento > validacao, "o teste não atravessa o contrato de orçamento");
  assert.ok(provedor > orcamento, "o provedor é chamado antes de reservar orçamento");
  assert.doesNotMatch(codigo, /generateText\(/, "voltou o caminho lateral sem liquidação");
  assert.match(codigo, /maxOutputTokens/, "o teste não limita a resposta real");
  assert.match(codigo, /maxRetries:\s*0/, "retry automático pode cobrar sem reserva própria");
});

test("a matriz de permissão não conhece Supabase nem rede", () => {
  // Ela autoriza gasto de IA e leitura de credencial. Uma regra dessas precisa
  // ser contável sem subir aplicação nenhuma.
  const codigo = lerCodigo("src/lib/ai/permissao.ts");
  for (const proibido of ["supabase", "fetch(", "process.env"]) {
    assert.ok(!codigo.includes(proibido), `permissao.ts não deve conhecer ${proibido}`);
  }
});

/**
 * Q1. Toda superfície crítica tem fronteira de erro.
 *
 * Fronteira de erro é a peça que nunca aparece quando tudo vai bem, e por isso
 * é a que mais facilmente falta sem ninguém notar. A lista abaixo é o escopo
 * revisado: perder qualquer uma delas devolve a pessoa à tela genérica do
 * Next, que a tira do produto — some a barra, some a navegação, e a única saída
 * é o botão de voltar do navegador.
 */
const SUPERFICIES_COM_FRONTEIRA = [
  ["contexto de marca", "src/app/w/[workspaceSlug]/b/[brandKey]/error.tsx"],
  ["manual", "src/app/w/[workspaceSlug]/b/[brandKey]/docs/error.tsx"],
  ["documento", "src/app/w/[workspaceSlug]/b/[brandKey]/docs/[...slug]/error.tsx"],
  ["chat", "src/app/w/[workspaceSlug]/b/[brandKey]/docs/chat/error.tsx"],
  ["análise", "src/app/w/[workspaceSlug]/b/[brandKey]/docs/analise/error.tsx"],
  ["administração", "src/app/w/[workspaceSlug]/b/[brandKey]/docs/admin/error.tsx"],
  ["importação", "src/app/w/[workspaceSlug]/importar/error.tsx"],
  ["aplicação", "src/app/error.tsx"],
] as const;

test("cada superfície crítica tem a sua fronteira de erro", () => {
  for (const [superficie, arquivo] of SUPERFICIES_COM_FRONTEIRA) {
    const codigo = lerCodigo(arquivo);
    assert.match(codigo, /"use client"/, `${superficie}: fronteira precisa ser de cliente`);
    assert.match(codigo, /LimiteDeErro/, `${superficie}: não usa a peça compartilhada`);
    assert.match(codigo, /reset/, `${superficie}: não oferece tentar de novo`);
  }
});

test("nenhuma fronteira renderiza a mensagem do erro", () => {
  // Ela pode carregar caminho de arquivo, fragmento de consulta e, por ele,
  // texto do manual de um cliente. A tela é o lugar mais público onde isso
  // sairia — inclusive numa captura colada num chat de equipe.
  for (const [superficie, arquivo] of SUPERFICIES_COM_FRONTEIRA) {
    assert.doesNotMatch(
      lerCodigo(arquivo),
      /error\.message/,
      `${superficie}: a mensagem técnica chega à tela`,
    );
  }
  assert.doesNotMatch(lerCodigo("src/components/shell/LimiteDeErro.tsx"), /error\.message/);
});

test("a copy da falha é do produto, e diz o que NÃO aconteceu", () => {
  // "Nenhuma alteração foi salva" é a frase que importa numa tela de edição:
  // a dúvida sobre o que ficou gravado pela metade custa mais que a falha.
  const escrita: Record<string, RegExp> = {
    "src/app/w/[workspaceSlug]/b/[brandKey]/docs/admin/error.tsx": /Nenhuma alteração foi salva/,
    "src/app/w/[workspaceSlug]/b/[brandKey]/docs/chat/error.tsx": /Nenhuma pergunta foi enviada/,
    "src/app/w/[workspaceSlug]/b/[brandKey]/docs/analise/error.tsx": /Nenhuma peça foi enviada/,
    "src/app/w/[workspaceSlug]/importar/error.tsx": /Nenhuma marca foi criada/,
  };
  for (const [arquivo, frase] of Object.entries(escrita)) {
    assert.match(lerCodigo(arquivo), frase, `${arquivo}: falta dizer o que não aconteceu`);
  }
});

test("toda fronteira oferece uma saída além de tentar de novo", () => {
  // "Tentar de novo" pode falhar de novo. Sem outra saída, a pessoa fica presa
  // numa tela cujo único botão não funciona.
  for (const [superficie, arquivo] of SUPERFICIES_COM_FRONTEIRA) {
    assert.match(lerCodigo(arquivo), /retorno=/, `${superficie}: sem saída segura`);
  }
});

test("a moldura publica quando os atalhos estão registrados", () => {
  // Sem esse sinal, um teste de atalho só pode esperar por tempo — e esperar
  // por tempo passa mesmo com o atalho quebrado, desde que se espere bastante.
  const codigo = lerCodigo("src/components/shell/AppShellV2.tsx");
  const efeito = codigo.slice(codigo.indexOf("addEventListener(\"keydown\""));
  assert.match(
    efeito.slice(0, 400),
    /data-shell-ready/,
    "o sinal precisa ser publicado no mesmo efeito que registra os atalhos",
  );
});

/**
 * V1. Existem dois vocabulários de cor, e só dois.
 *
 * Havia um terceiro, e ele era o problema: `--color-release-analog-*` nasceu do
 * release de um cliente — "Call Me Analog Man" — e virou o acento de toda a
 * interface, junto de uma camada semântica (`background-primary`,
 * `text-secondary`, `border-default`) que não dizia se a cor era da moldura ou
 * da marca.
 *
 * Enquanto ele existia, um componente novo podia consumi-lo e FUNCIONAR — e
 * funcionar era o problema, porque a escolha entre moldura e marca deixava de
 * ser obrigatória.
 */
test("nenhum arquivo do produto usa o vocabulário de cor legado", () => {
  const arquivos = [
    ...listarArquivos("src/app"),
    ...listarArquivos("src/components"),
    ...listarArquivos("src/platform"),
    ...listarArquivos("src/lib"),
  ].filter((c) => /\.(tsx?|css)$/.test(c) && !c.includes(".test."));

  /*
   * Os nomes precisam ser casados com fronteira à esquerda: `accent-secondary`
   * é sufixo de `--color-brand-accent-secondary`, que é o token NOVO e legítimo.
   * Uma guarda por substring solta acusaria o certo junto com o errado, e a
   * primeira coisa que alguém faria seria afrouxá-la.
   */
  const legado = [
    "release-analog",
    "text-text-secondary", "text-text-primary", "text-text-inverse",
    "border-border-default", "border-border-strong",
    "bg-surface-primary", "bg-surface-light",
    "bg-background-primary", "bg-background-secondary",
    "color-accent-primary", "color-accent-secondary", "color-focus-ring",
    "color-background-primary", "color-text-primary", "color-text-secondary",
  ];

  const infratores: string[] = [];
  for (const arquivo of arquivos) {
    const codigo = lerCodigo(arquivo);
    for (const termo of legado) {
      const achou = new RegExp(`(?<![\\w-])${termo.replace(/[-]/g, "-")}(?![\\w-])`);
      if (achou.test(codigo)) infratores.push(`${arquivo}: ${termo}`);
    }
  }
  assert.deepEqual(infratores, [], "vocabulário legado de cor de volta no produto");
});

test("o canvas fala brand-*, e a moldura fala platform-*", () => {
  // A separação é o produto inteiro: a marca é o conteúdo, o Brennimark é o
  // sistema. Um `platform-*` dentro do canvas pinta o manual com a cor do
  // aplicativo; um `brand-*` na moldura veste o aplicativo com a cor de um
  // cliente, e a moldura é a mesma para todos.
  const canvas = [
    "src/components/docs/DocPage.tsx",
    ...listarArquivos("src/components/docs/blocks").filter((c) => c.endsWith(".tsx")),
  ];
  for (const arquivo of canvas) {
    const codigo = lerCodigo(arquivo);
    assert.doesNotMatch(
      codigo,
      /(bg|text|border|decoration|divide|accent)-platform-/,
      `${arquivo}: componente do canvas pintando com cor da plataforma`,
    );
  }

  for (const arquivo of listarArquivos("src/components/shell").filter((c) => c.endsWith(".tsx"))) {
    assert.doesNotMatch(
      lerCodigo(arquivo),
      /(bg|text|border|decoration|divide|accent)-brand-/,
      `${arquivo}: componente da moldura vestindo a cor de uma marca`,
    );
  }
});

test("não existe instância global de marca em runtime", () => {
  // `brandvilleInstance` era resolvida por variável de build na inicialização
  // do processo: duas contas servidas pelo mesmo processo viam a mesma marca.
  const arquivos = [
    ...listarArquivos("src/app"),
    ...listarArquivos("src/components"),
    ...listarArquivos("src/lib"),
    ...listarArquivos("src/brandville"),
  ].filter((c) => /\.tsx?$/.test(c) && !c.includes(".test."));

  for (const arquivo of arquivos) {
    const codigo = lerCodigo(arquivo);
    assert.doesNotMatch(codigo, /brandvilleInstance/, `${arquivo}: lê a instância global`);
    assert.doesNotMatch(
      codigo,
      /NEXT_PUBLIC_BRANDVILLE_INSTANCE/,
      `${arquivo}: escolhe marca por variável de build`,
    );
  }
});

test("o codinome legado não sobra em nome que roda", () => {
  // Comentários podem contar a história — é assim que se sabe por que algo foi
  // removido. O que não pode é um IDENTIFICADOR ou uma variável de ambiente
  // carregar o codinome: esses existem em tempo de execução.
  const arquivos = [
    ...listarArquivos("src/app"),
    ...listarArquivos("src/components"),
    ...listarArquivos("src/platform"),
  ].filter((c) => /\.(tsx?|css)$/.test(c) && !c.includes(".test."));

  for (const arquivo of arquivos) {
    const codigo = lerCodigo(arquivo);
    assert.doesNotMatch(codigo, /BRANDVILLE_DEV_SKIP_AUTH/, `${arquivo}: variável com o codinome`);
    assert.doesNotMatch(codigo, /Call Me Analog/, `${arquivo}: nome de release de cliente`);
  }
});

/**
 * P0. A rota que os testes exercitam e a que produção serve montam o MESMO
 * importador.
 *
 * O laboratório `/dev/importar` é 404 em produção, por construção. Logo o
 * `BrandImporter` publicado — em `/w/<conta>/importar` — nunca foi tocado por
 * teste de navegador nenhum: ele exige sessão de quem administra, e o preview
 * local não concede papel.
 *
 * Enquanto as duas rotas montarem o mesmo componente com os mesmos padrões, o
 * que o laboratório prova vale para a publicada. No dia em que uma delas
 * receber uma prop diferente, essa equivalência quebra em silêncio — e foi
 * exatamente uma divergência entre caminho testado e caminho publicado que
 * levantou este P0.
 */
test("laboratório e rota real montam o mesmo importador", () => {
  const lab = lerCodigo("src/app/dev/importar/page.tsx");
  const real = lerCodigo("src/app/w/[workspaceSlug]/importar/page.tsx");

  for (const [nome, codigo] of [["laboratório", lab], ["rota real", real]] as const) {
    assert.match(codigo, /<BrandImporter\b/, `${nome} não monta o BrandImporter`);
  }

  /*
   * A ÚNICA prop que pode divergir é `limites`, e só no laboratório: testar a
   * recusa por tamanho com o limite real exigiria carregar 100 MiB num
   * navegador de teste. Qualquer outra diferença faz o laboratório provar algo
   * sobre um componente que produção não monta.
   */
  /*
   * Casa prop COM e SEM valor. A primeira versão desta guarda só via `nome=`,
   * e uma prop booleana — `<BrandImporter modoDeTeste />` — passava por ela.
   * Descobri injetando exatamente isso: a guarda ficou verde, e uma guarda que
   * não fica vermelha na regressão que descreve não é guarda.
   */
  const props = (codigo: string) =>
    [...codigo.matchAll(/<BrandImporter([\s\S]*?)\/>/g)]
      .flatMap((m) => [...m[1].matchAll(/(?:^|\s)([a-zA-Z][\w]*)(?==|\s|$)/g)].map((p) => p[1]))
      .sort();

  const soNoLab = props(lab).filter((p) => !props(real).includes(p));
  assert.deepEqual(soNoLab, ["limites"], "o laboratório monta o importador diferente da produção");

  const soNaReal = props(real).filter((p) => !props(lab).includes(p));
  assert.deepEqual(soNaReal, [], "a rota real passa prop que o laboratório não exercita");
});

test("o detector de títulos exige uma palavra, não só destaque", () => {
  // Num manual de identidade, páginas inteiras mostram letras em corpo enorme.
  // Sem esta regra, um "G g" de 200pt sobre legenda de 8pt vira seção — e o
  // índice do manual vira a tabela de glifos. Foram nove no GE_ID000.
  const codigo = lerCodigo("src/lib/import/secoes.ts");
  const trecho = codigo.slice(codigo.indexOf("function tituloVisual"));
  assert.match(
    trecho.slice(0, 2_000),
    /length >= 2/,
    "destaque tipográfico voltou a bastar para virar título",
  );
});

test("liquidar exige registro de exposição — a invariante recíproca", () => {
  /*
   * `charge_exposed_at` fecha duas portas, não uma. Uma: não se libera reserva
   * exposta. A outra, esta: não existe execução LIQUIDADA sem registro de
   * exposição ao provedor — liquidar sem ele seria cobrar por um pedido que o
   * razão não sabe ter saído.
   *
   * A guarda é textual porque a invariante vive em SQL e o CI deste projeto
   * não sobe Supabase (ver ci.yml). Ela não prova o comportamento no banco;
   * prova que a regra não sumiu do arquivo — que é o que se pode provar daqui,
   * e é melhor que nada guardar.
   */
  const migracao = lerCodigo(
    "supabase/migrations/20260909014823_ai_ledger_exposicao_de_cobranca.sql",
  );
  assert.match(
    migracao,
    /if linha\.charge_exposed_at is null then\s*\n\s*raise exception/,
    "consolidar precisa recusar liquidação sem exposição registrada",
  );
  assert.match(
    migracao,
    /for update/,
    "as funções que leem e depois atualizam a mesma linha precisam travá-la",
  );
});

test("a prova de concorrência não mascara falha de nenhuma sessão", () => {
  /*
   * O estado final pode parecer correto mesmo quando um dos dois processos
   * SQL morreu antes de disputar a trava. Cada PID precisa ser aguardado
   * separadamente, e um exit code não-zero precisa reprovar o rig.
   */
  const rig = lerCodigo("scripts/prova-de-concorrencia-ai-ledger.sh");
  assert.doesNotMatch(
    rig,
    /wait\s+"\$pidA"\s+"\$pidB"[^\n]*\|\|\s*true/,
    "o rig voltou a esconder o exit code das duas sessões",
  );
  assert.match(rig, /if wait "\$pidA"/, "a sessão A precisa ter o exit code conferido");
  assert.match(rig, /if wait "\$pidB"/, "a sessão B precisa ter o exit code conferido");
});

test("a exceção de advisor do kill switch só vale enquanto as duas guardas existirem", () => {
  /*
   * `kill_switch_ativo` é `SECURITY DEFINER` executável por `authenticated`, e
   * o advisor do Supabase acusa isso (regra 0029). A exceção foi registrada
   * como intencional em `20260910215914_kill_switch_excecao_registrada.sql` —
   * mas ela é aceitável por ser ESTREITA, não por estar escrita.
   *
   * Este teste é o que impede a justificativa de sobreviver ao que a
   * justificava. Se alguém remover a exigência de autenticação, a checagem de
   * membership, ou fizer a função devolver mais que os dois booleanos, a
   * exceção deixa de valer — e aqui reprova.
   */
  const migracao = lerCodigo(
    "supabase/migrations/20260903152804_ai_budget_expiry_and_kill_switch_read.sql",
  );
  const corpo = migracao.slice(
    migracao.indexOf("create or replace function public.kill_switch_ativo"),
  );

  assert.match(
    corpo,
    /if actor is null then\s*\n\s*raise exception 'authentication required'/,
    "sem exigir autenticação, a função vira leitura anônima do estado do orçamento",
  );
  assert.match(
    corpo,
    /from public\.workspace_members m\s*\n\s*where m\.workspace_id = p_workspace_id and m\.user_id = actor/,
    "sem a checagem de membership, qualquer autenticado lê o kill switch de qualquer conta",
  );
  assert.match(
    corpo,
    /returns table \(workspace boolean, marca boolean\)/,
    "a exceção se apoia em devolver DOIS BOOLEANOS e nada mais da linha de orçamento",
  );
});
