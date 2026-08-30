import assert from "node:assert/strict";
import test from "node:test";
import { BRAND_CAPABILITIES, can, capabilitiesForRole } from "./capabilities";
import { shellSections } from "../components/shell/navigation";

test("o vocabulário tem exatamente as quatro capacidades decididas", () => {
  assert.deepEqual([...BRAND_CAPABILITIES], ["consultar", "editar", "aprovar", "administrar"]);
});

test("member consulta e nada além disso", () => {
  const caps = capabilitiesForRole("member");
  assert.ok(can(caps, "consultar"));
  for (const c of ["editar", "aprovar", "administrar"] as const) {
    assert.ok(!can(caps, c), `member não deveria poder ${c}`);
  }
});

test("owner tem as quatro, preservando o comportamento atual", () => {
  const caps = capabilitiesForRole("owner");
  for (const c of BRAND_CAPABILITIES) assert.ok(can(caps, c), `owner deveria poder ${c}`);
});

test("sem sessão não há capacidade alguma", () => {
  assert.deepEqual(capabilitiesForRole(null), []);
  assert.ok(!can(capabilitiesForRole(null), "consultar"));
});

test("editar não implica aprovar — é a separação que sustenta agência e dono da marca", () => {
  const agencia = ["consultar", "editar"] as const;
  assert.ok(can(agencia, "editar"));
  assert.ok(!can(agencia, "aprovar"));
});

test("aprovar não implica administrar", () => {
  const gestor = ["consultar", "aprovar"] as const;
  assert.ok(can(gestor, "aprovar"));
  assert.ok(!can(gestor, "administrar"));
});

test("a navegação some para quem só consulta, em vez de aparecer desabilitada", async () => {
  const { shellSections } = await import("../components/shell/navigation");
  const consulta = shellSections({ capabilities: capabilitiesForRole("member"), locale: "pt-BR" });
  const admin = shellSections({ capabilities: capabilitiesForRole("owner"), locale: "pt-BR" });

  const hrefs = (s: ReturnType<typeof shellSections>) => s.flatMap((x) => x.destinations.map((d) => d.href));

  assert.ok(!hrefs(consulta).includes("/docs/admin"), "consultor recebeu destino de administração");
  assert.ok(hrefs(admin).includes("/docs/admin"), "administrador não recebeu administração");
  assert.ok(hrefs(consulta).length > 0, "consultor ficou sem destino algum");
});

// ─── As funcionalidades são da marca ────────────────────────────────────────

/**
 * A seção "Inteligência" ficava permanentemente vazia.
 *
 * `shellSections` lia as chaves de `brandvilleUtilityLinks`, que por sua vez
 * lia a instância global — e a instância global é `unconfigured`, com zero
 * utilidades. Nenhuma marca, por mais completa, conseguia mostrar o assistente
 * na navegação. A promoção da V2 levou esse fio junto.
 */
const OWNER = capabilitiesForRole("owner");

function inteligencia(secoes: ReturnType<typeof shellSections>) {
  return secoes.find((s) => s.id === "intelligence");
}

test("sem utilidades declaradas, não existe seção de Inteligência", () => {
  const secoes = shellSections({ capabilities: OWNER, locale: "pt-BR", utilityLinks: [] });
  assert.equal(inteligencia(secoes), undefined, "seção vazia é área morta na navegação");
});

test("a marca sem utilidades e a marca omissa dão no mesmo", () => {
  const omissa = shellSections({ capabilities: OWNER, locale: "pt-BR" });
  assert.equal(inteligencia(omissa), undefined);
});

test("a marca completa mostra as quatro funcionalidades", () => {
  const secoes = shellSections({
    capabilities: OWNER,
    locale: "pt-BR",
    utilityLinks: ["chat", "analysis", "history", "ai-settings"],
  });
  const destinos = inteligencia(secoes)!.destinations.map((d) => d.href);
  assert.deepEqual(destinos, [
    "/docs/chat",
    "/docs/analise",
    "/docs/historico",
    "/docs/configuracoes/ia",
  ]);
});

test("o rótulo da funcionalidade fala o idioma da INTERFACE", () => {
  const pt = shellSections({ capabilities: OWNER, locale: "pt-BR", utilityLinks: ["chat"] });
  const en = shellSections({ capabilities: OWNER, locale: "en", utilityLinks: ["chat"] });
  // A rota é do produto; o rótulo também. O idioma do manual não entra.
  assert.equal(inteligencia(pt)!.destinations[0].label, "Chat da marca");
  assert.equal(inteligencia(en)!.destinations[0].label, "Brand assistant");
});

test("duas marcas no mesmo processo não trocam de funcionalidades", () => {
  const soChat = shellSections({ capabilities: OWNER, locale: "pt-BR", utilityLinks: ["chat"] });
  const semChat = shellSections({
    capabilities: OWNER,
    locale: "pt-BR",
    utilityLinks: ["analysis", "history"],
  });
  const deNovoSoChat = shellSections({
    capabilities: OWNER,
    locale: "pt-BR",
    utilityLinks: ["chat"],
  });

  assert.deepEqual(inteligencia(soChat)!.destinations.map((d) => d.href), ["/docs/chat"]);
  assert.deepEqual(inteligencia(semChat)!.destinations.map((d) => d.href), [
    "/docs/analise",
    "/docs/historico",
  ]);
  // A chamada do meio não pode contaminar a terceira.
  assert.deepEqual(inteligencia(deNovoSoChat), inteligencia(soChat));
});

test("uma chave desconhecida não vira destino quebrado", () => {
  const secoes = shellSections({
    capabilities: OWNER,
    locale: "pt-BR",
    // Uma marca antiga pode declarar uma funcionalidade que o produto
    // aposentou; ela some, em vez de virar link para lugar nenhum.
    utilityLinks: ["chat", "inexistente" as never],
  });
  assert.deepEqual(inteligencia(secoes)!.destinations.map((d) => d.href), ["/docs/chat"]);
});
