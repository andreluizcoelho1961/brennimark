import assert from "node:assert/strict";
import test from "node:test";
import { brandPromptContext, carregarWorkspaceContext, montarContexto } from "./context";
import { buildChatSystemPrompt } from "../ai/brand-context";
import type { ActiveBrand } from "./brand-row";
import type { DocPageEntry } from "../../content/docs";

/**
 * O contrato da resolução por requisição.
 *
 * Duas famílias de teste. A primeira protege a REGRA — o que cada situação
 * produz. A segunda protege a SEQUÊNCIA — quantas vezes cada dependência roda.
 * A segunda existe porque o patch 1 afirmava "uma resolução por requisição" em
 * comentário, e o comentário estava errado: autenticação e marca rodavam duas
 * vezes cada. Comentário não é garantia; contador é.
 */

const MARCA: ActiveBrand = {
  id: "id-marca",
  key: "marca-teste",
  brand: { name: "Marca Teste", shortName: "MT", descriptor: "descritor da marca" },
  metadata: { title: "Marca Teste", description: "", language: "en" },
  navigation: { groups: ["Grupo"], groupCodes: {}, defaultDocSlug: "abertura", utilityLinks: [] },
  theme: {
    background: "#000", backgroundSecondary: "#000", surface: "#111", surfaceLight: "#222",
    foreground: "#fff", muted: "#999", accent: "#f00", accentSecondary: "#0f0",
    border: "#333", focus: "#fff", fontStack: "var(--font-ui)",
  },
  ai: { knowledgeMode: "docs", chatRole: "", analysisRole: "" },
  legal: { footerNotice: "" },
};

const PAGINA: DocPageEntry = {
  slug: "abertura", group: "Grupo", title: "Abertura", status: "ready", body: ["texto"],
};

// ─── A regra ────────────────────────────────────────────────────────────────

test("sem sessão, nenhuma capacidade — nem consultar", () => {
  const ctx = montarContexto({ access: "anonymous", auth: null, marca: null, docs: [] });
  // O fallback `?? "member"` do patch 1 dava `consultar` a quem não tinha
  // sessão, contradizendo o contrato de capabilitiesForRole(null) === [].
  assert.deepEqual(ctx.capabilities, []);
});

test("sem sessão não há marca, documento nem slug de entrada", () => {
  const ctx = montarContexto({ access: "anonymous", auth: null, marca: null, docs: [] });
  assert.equal(ctx.brand, null);
  assert.deepEqual(ctx.docs, []);
  assert.equal(ctx.userEmail, undefined);
  assert.equal(ctx.defaultDocSlug, null);
});

test("member consulta e nada além disso", () => {
  const ctx = montarContexto({
    access: "ready", auth: { role: "member", email: "a@b.c" }, marca: MARCA, docs: [],
  });
  assert.deepEqual(ctx.capabilities, ["consultar"]);
});

test("owner recebe as quatro capacidades", () => {
  const ctx = montarContexto({
    access: "ready", auth: { role: "owner", email: "a@b.c" }, marca: MARCA, docs: [],
  });
  assert.deepEqual(ctx.capabilities, ["consultar", "editar", "aprovar", "administrar"]);
});

test("ausência de marca é nula, não uma marca falsa", () => {
  const ctx = montarContexto({
    access: "ready", auth: { role: "owner", email: "a@b.c" }, marca: null, docs: [],
  });
  assert.equal(ctx.brand, null);
  assert.equal(ctx.defaultDocSlug, null);
});

test("a marca resolvida define nome, descritor, tema e documento de entrada", () => {
  const ctx = montarContexto({
    access: "ready", auth: { role: "member", email: "a@b.c" }, marca: MARCA, docs: [],
  });
  assert.equal(ctx.brand?.brand.name, "Marca Teste");
  assert.equal(ctx.brand?.brand.descriptor, "descritor da marca");
  assert.equal(ctx.brand?.theme.accent, "#f00");
  assert.equal(ctx.defaultDocSlug, "abertura");
});

test("o idioma da interface não vem do idioma do manual", () => {
  const ctx = montarContexto({
    access: "ready", auth: { role: "owner", email: "a@b.c" }, marca: MARCA, docs: [],
  });
  // O manual está em inglês; a interface continua em português. Login,
  // navegação e administração são do Brennimark, não da marca apresentada.
  assert.equal(ctx.locale, "pt-BR");
});

test("marca sem documento de entrada não vira redirecionamento", () => {
  const semPadrao = { ...MARCA, navigation: { ...MARCA.navigation, defaultDocSlug: "" } };
  const ctx = montarContexto({
    access: "ready", auth: { role: "owner", email: "a@b.c" }, marca: semPadrao, docs: [],
  });
  // Redirecionar para /docs/ vazio produziria laço.
  assert.equal(ctx.defaultDocSlug, null);
});

// ─── A sequência ────────────────────────────────────────────────────────────

function espionar({
  auth,
  profile,
  marca,
  docs,
  comSessao = false,
}: {
  auth: { role: "owner" | "member"; email?: string } | null;
  /** Existe sessão sem conta? É o estado do primeiro usuário do produto. */
  comSessao?: boolean;
  profile?: { fullName: string } | null;
  marca?: ActiveBrand | null;
  docs?: DocPageEntry[];
}) {
  const contagem = { getAuth: 0, getProfile: 0, getActiveBrand: 0, getDocsByBrandId: 0, temSessao: 0 };
  const brandIdsPedidos: string[] = [];
  return {
    contagem,
    brandIdsPedidos,
    deps: {
      temSessao: async () => {
        contagem.temSessao += 1;
        return comSessao;
      },
      getAuth: async () => {
        contagem.getAuth += 1;
        return auth;
      },
      getProfile: async () => {
        contagem.getProfile += 1;
        return profile === undefined ? { fullName: "Alguém" } : profile;
      },
      getActiveBrand: async () => {
        contagem.getActiveBrand += 1;
        return marca === undefined ? MARCA : marca;
      },
      getDocsByBrandId: async (_auth: unknown, brandId: string) => {
        contagem.getDocsByBrandId += 1;
        brandIdsPedidos.push(brandId);
        return docs ?? [PAGINA];
      },
    },
  };
}

test("com sessão e marca, cada dependência roda exatamente uma vez", async () => {
  const espiao = espionar({ auth: { role: "owner", email: "a@b.c" } });
  const ctx = await carregarWorkspaceContext(espiao.deps);

  assert.deepEqual(espiao.contagem, {
    getAuth: 1,
    getProfile: 1,
    getActiveBrand: 1,
    getDocsByBrandId: 1,
    // Com conta, não é preciso perguntar se existe sessão: getAuth já provou.
    temSessao: 0,
  });
  assert.equal(ctx.access, "ready");
  assert.equal(ctx.docs.length, 1);
});

test("os documentos são pedidos para a marca que foi resolvida", async () => {
  const espiao = espionar({ auth: { role: "owner", email: "a@b.c" } });
  const ctx = await carregarWorkspaceContext(espiao.deps);
  // A regressão que isto impede: a consulta de documentos descobrir a marca
  // por conta própria e chegar a outra que não a do contexto.
  assert.deepEqual(espiao.brandIdsPedidos, [MARCA.id]);
  assert.equal(ctx.brand?.id, MARCA.id);
});

test("sem marca, nenhum documento é consultado", async () => {
  const espiao = espionar({ auth: { role: "owner", email: "a@b.c" }, marca: null });
  const ctx = await carregarWorkspaceContext(espiao.deps);

  assert.equal(espiao.contagem.getActiveBrand, 1);
  assert.equal(espiao.contagem.getDocsByBrandId, 0, "consulta sem marca é viagem perdida");
  assert.deepEqual(ctx.docs, []);
});

test("sem sessão, nada além da autenticação é consultado", async () => {
  const espiao = espionar({ auth: null });
  const ctx = await carregarWorkspaceContext(espiao.deps);

  assert.deepEqual(espiao.contagem, {
    getAuth: 1,
    getProfile: 0,
    getActiveBrand: 0,
    getDocsByBrandId: 0,
    // Uma pergunta a mais, e ela é a que separa visitante de quem só falta
    // completar o cadastro.
    temSessao: 1,
  });
  assert.equal(ctx.access, "anonymous");
  assert.deepEqual(ctx.capabilities, []);
});

test("perfil incompleto leva ao onboarding e não busca documentos", async () => {
  const espiao = espionar({ auth: { role: "owner", email: "a@b.c" }, profile: null });
  const ctx = await carregarWorkspaceContext(espiao.deps);

  assert.equal(ctx.access, "onboarding");
  assert.equal(espiao.contagem.getDocsByBrandId, 0);
  assert.equal(ctx.brand, null, "quem ainda não completou o cadastro não abre manual");
});

test("perfil completo libera a renderização", async () => {
  const espiao = espionar({
    auth: { role: "member", email: "a@b.c" },
    profile: { fullName: "Alguém" },
  });
  const ctx = await carregarWorkspaceContext(espiao.deps);
  assert.equal(ctx.access, "ready");
  assert.equal(ctx.brand?.id, MARCA.id);
});

test("o preview local dispensa o redirecionamento, não a regra de capacidade", async () => {
  const espiao = espionar({ auth: null });
  const ctx = await carregarWorkspaceContext({ ...espiao.deps, devPreview: true });

  assert.equal(ctx.access, "development-preview");
  // O ponto do teste: modo local não vira autorização. Sem papel, sem
  // capacidade — igual a qualquer visitante.
  assert.deepEqual(ctx.capabilities, []);
});

// ─── O adaptador que as rotas realmente usam ───────────────────────────────

/**
 * O caminho de produção, ponta a ponta.
 *
 * Os testes do prompt montavam `BrandPromptContext` à mão, o que é bom para
 * isolar a regra e péssimo como garantia: eles passavam por fora de
 * `brandPromptContext`, que é a única função que as rotas de chat e análise
 * chamam. O adaptador descartava `statusLabels` e o CI continuou verde.
 *
 * Um campo opcional some sem erro de tipo, sem exceção e sem teste vermelho.
 * Só um teste que atravessa o adaptador percebe.
 */
const MARCA_EDITORIAL: ActiveBrand = {
  ...MARCA,
  metadata: { ...MARCA.metadata, language: "pt-BR" },
  ai: {
    knowledgeMode: "docs",
    chatRole: "Você é o guia da Editorial.",
    analysisRole: "Você avalia peças da Editorial.",
  },
  statusLabels: { ready: "Documentado", draft: "Em validação", pending: "Sem diretriz" },
};

test("o adaptador entrega o vocabulário da marca ao prompt", () => {
  const contexto = brandPromptContext(MARCA_EDITORIAL);

  assert.deepEqual(contexto.statusLabels, MARCA_EDITORIAL.statusLabels);
  assert.equal(contexto.language, "pt-BR");
  assert.equal(contexto.chatRole, "Você é o guia da Editorial.");
  assert.equal(contexto.analysisRole, "Você avalia peças da Editorial.");
});

test("o prompt construído pelo caminho de produção usa o vocabulário da marca", () => {
  // Este é o teste que faltava: nada de objeto montado à mão. A marca entra
  // como ela sai do banco e o prompt sai como ele vai para o modelo.
  const prompt = buildChatSystemPrompt(
    [{ slug: "grade", group: "Sistema", title: "Grade", status: "ready", body: ["Doze colunas."] }],
    brandPromptContext(MARCA_EDITORIAL),
  );

  assert.match(prompt, /status="DOCUMENTADO"/);
  assert.match(prompt, /DOCUMENTADO é regra estabelecida/);
  assert.match(prompt, /STATUS é exatamente um destes: DOCUMENTADO, EM VALIDAÇÃO, SEM DIRETRIZ/);
  assert.doesNotMatch(prompt, /PRONTO/, "os rótulos do produto não podem sobreviver ao override");
});

test("marca sem vocabulário próprio continua usando os rótulos do produto", () => {
  const semVocabulario = { ...MARCA_EDITORIAL, statusLabels: undefined };
  const prompt = buildChatSystemPrompt(
    [{ slug: "grade", group: "Sistema", title: "Grade", status: "ready", body: ["Doze colunas."] }],
    brandPromptContext(semVocabulario),
  );

  assert.match(prompt, /status="PRONTO"/);
  assert.doesNotMatch(prompt, /DOCUMENTADO/);
});

test("sessão sem conta vai para o cadastro, não para o login", async () => {
  // O primeiro usuário do produto vive exatamente aqui: e-mail confirmado,
  // nenhum workspace. Tratá-lo como visitante o mandava ao login, e o login —
  // vendo que ele tem sessão — o mandava de volta. Laço fechado, e o cadastro
  // que criaria a conta era inalcançável.
  const espiao = espionar({ auth: null, comSessao: true });
  const ctx = await carregarWorkspaceContext(espiao.deps);

  assert.equal(ctx.access, "onboarding");
  assert.deepEqual(ctx.capabilities, [], "ainda não há papel");
  assert.equal(espiao.contagem.getActiveBrand, 0, "sem conta não há marca a buscar");
});

test("sem sessão nenhuma continua sendo visitante", async () => {
  const espiao = espionar({ auth: null, comSessao: false });
  const ctx = await carregarWorkspaceContext(espiao.deps);
  assert.equal(ctx.access, "anonymous");
});

test("o preview local não consulta a sessão", async () => {
  const espiao = espionar({ auth: null, comSessao: true });
  const ctx = await carregarWorkspaceContext({ ...espiao.deps, devPreview: true });
  assert.equal(ctx.access, "development-preview");
  assert.equal(espiao.contagem.temSessao, 0, "modo local não pergunta ao Supabase");
});
