import assert from "node:assert/strict";
import test from "node:test";
import { brandvilleInstances, resolveBrandvilleInstance } from "./config";
import type { BrandvilleInstance } from "./types";

// Object.entries widens each value to the union of the concrete instance
// types, and one member's groupCodes has literal keys (no string index
// signature). Read them back through the contract type so groupCodes is
// the declared Record<string, string> the test indexes by group name.
for (const [key, instance] of Object.entries(brandvilleInstances) as [string, BrandvilleInstance][]) {
  test(`instância ${key} tem contrato íntegro`, () => {
    assert.equal(instance.key, key);
    assert.ok(instance.brand.name);
    assert.ok(instance.docs.length > 0);
    assert.ok(instance.navigation.groups.length > 0);
    assert.ok(instance.docs.some((doc) => doc.slug === instance.navigation.defaultDocSlug));
    assert.equal(new Set(instance.docs.map((doc) => doc.slug)).size, instance.docs.length);
    for (const group of instance.navigation.groups) {
      assert.ok(instance.navigation.groupCodes[group], `código ausente para ${group}`);
      assert.ok(instance.docs.some((doc) => doc.group === group), `grupo sem página: ${group}`);
    }
    for (const color of [instance.theme.background, instance.theme.foreground, instance.theme.accent]) {
      assert.match(color, /^#[0-9a-f]{6}$/i);
    }
  });
}

test("falha de forma explícita para instância desconhecida", () => {
  assert.throws(() => resolveBrandvilleInstance("inexistente"), /Instância Brandville desconhecida/);
});
