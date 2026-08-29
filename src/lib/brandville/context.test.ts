import assert from "node:assert/strict";
import test from "node:test";
import { carregarWorkspaceContext, montarContexto } from "./context";
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
}: {
  auth: { role: "owner" | "member"; email?: string } | null;
  profile?: { fullName: string } | null;
  marca?: ActiveBrand | null;
  docs?: DocPageEntry[];
}) {
  const contagem = { getAuth: 0, getProfile: 0, getActiveBrand: 0, getDocsByBrandId: 0 };
  const brandIdsPedidos: string[] = [];
  return {
    contagem,
    brandIdsPedidos,
    deps: {
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
