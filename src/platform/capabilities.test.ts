import assert from "node:assert/strict";
import test from "node:test";
import { BRAND_CAPABILITIES, can, capabilitiesForRole } from "./capabilities";

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
