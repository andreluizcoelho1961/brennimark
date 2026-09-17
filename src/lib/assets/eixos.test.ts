import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { EIXOS_POR_TIPO, TIPOS_DE_ITEM, colunasDoTipo, conferirEixos, formatoDoArquivo, lerEixos, motivoDaRecusa, type Eixos } from "./eixos";

/**
 * A matriz dos eixos, do lado da tela.
 *
 * O banco é quem recusa (`scripts/prova-item-e-variante.sh`, 38 casos). Estes
 * testes existem para a tela e o banco não divergirem sem ninguém perceber: os
 * casos abaixo são os MESMOS da prova, e o último teste lê a migration para
 * conferir que cada nome de trava que a rota traduz ainda existe lá.
 */

const vazio: Eixos = { hierarquia: null, lockup: null, cor: null, polaridade: null, espaco_de_cor: null };
const logoCompleto: Eixos = { hierarquia: "principal", lockup: "horizontal", cor: "colorido", polaridade: "positivo", espaco_de_cor: "rgb" };

test("logo com os cinco eixos passa", () => {
  assert.deepEqual(conferirEixos("logo", logoCompleto), { ok: true });
});

test("logo sem polaridade é recusado, e o motivo nomeia o eixo", () => {
  assert.deepEqual(conferirEixos("logo", { ...logoCompleto, polaridade: null }), { ok: false, motivo: "falta", eixo: "polaridade" });
});

test("paleta com lockup ou polaridade é recusada — proibido não é opcional", () => {
  assert.deepEqual(conferirEixos("paleta", { ...vazio, lockup: "horizontal", espaco_de_cor: "rgb" }), { ok: false, motivo: "sobra", eixo: "lockup" });
  assert.deepEqual(conferirEixos("paleta", { ...vazio, polaridade: "negativo", espaco_de_cor: "rgb" }), { ok: false, motivo: "sobra", eixo: "polaridade" });
});

test("paleta e gabarito exigem espaço de cor", () => {
  assert.deepEqual(conferirEixos("paleta", vazio), { ok: false, motivo: "falta", eixo: "espaco_de_cor" });
  assert.deepEqual(conferirEixos("gabarito", vazio), { ok: false, motivo: "falta", eixo: "espaco_de_cor" });
  assert.deepEqual(conferirEixos("paleta", { ...vazio, espaco_de_cor: "cmyk" }), { ok: true });
});

test("ícone exige cor, polaridade e espaço, e recusa hierarquia", () => {
  assert.deepEqual(conferirEixos("icone", { ...vazio, polaridade: "positivo", espaco_de_cor: "rgb" }), { ok: false, motivo: "falta", eixo: "cor" });
  assert.deepEqual(conferirEixos("icone", { ...logoCompleto, lockup: null }), { ok: false, motivo: "sobra", eixo: "hierarquia" });
  assert.deepEqual(conferirEixos("icone", { ...vazio, cor: "colorido", polaridade: "negativo", espaco_de_cor: "rgb" }), { ok: true });
});

test("foto entra sem eixo nenhum, e recusa eixo de cor", () => {
  assert.deepEqual(conferirEixos("foto", vazio), { ok: true });
  assert.deepEqual(conferirEixos("foto", { ...vazio, cor: "colorido" }), { ok: false, motivo: "sobra", eixo: "cor" });
});

test("fonte não aceita arquivo antes do termo, com qualquer eixo", () => {
  assert.deepEqual(conferirEixos("fonte", vazio), { ok: false, motivo: "exige-termo" });
});

test("todo tipo do vocabulário tem regra", () => {
  for (const tipo of TIPOS_DE_ITEM) assert.ok(EIXOS_POR_TIPO[tipo], `${tipo} sem regra`);
});

test("valor fora do vocabulário é recusado na leitura, antes de chegar ao banco", () => {
  const lido = lerEixos((nome) => (nome === "lockup" ? "diagonal" : ""));
  assert.deepEqual(lido, { invalido: "lockup" });
});

test("campo vazio vira nulo, não texto vazio", () => {
  const lido = lerEixos((nome) => (nome === "cor" ? " colorido " : "  "));
  assert.deepEqual(lido, { eixos: { ...vazio, cor: "colorido" } });
});

test("as colunas da matriz são só os eixos que o tipo usa", () => {
  assert.deepEqual(colunasDoTipo("logo"), ["hierarquia", "lockup", "cor", "polaridade", "espaco_de_cor"]);
  assert.deepEqual(colunasDoTipo("paleta"), ["espaco_de_cor"]);
  assert.deepEqual(colunasDoTipo("fonte"), []);
});

test("o formato vem da extensão, e sem extensão não se inventa", () => {
  assert.equal(formatoDoArquivo("logo-horizontal.svg"), "SVG");
  assert.equal(formatoDoArquivo("kit.final.eps"), "EPS");
  assert.equal(formatoDoArquivo("LEIAME"), "—");
  assert.equal(formatoDoArquivo(".oculto"), "—");
});

test("a recusa do banco vira motivo; recusa desconhecida não vira frase inventada", () => {
  assert.equal(motivoDaRecusa('new row violates "brand_assets_fonte_exige_termo"'), "exige-termo");
  assert.equal(motivoDaRecusa("logo exige hierarquia, lockup, cor, polaridade e espaço de cor"), "eixos");
  assert.equal(motivoDaRecusa("o item não existe nesta marca"), "item-de-outra-marca");
  assert.equal(motivoDaRecusa("o substituto precisa ser do mesmo item"), "substituto-de-outro-item");
  assert.equal(motivoDaRecusa("disk full"), null);
  assert.equal(motivoDaRecusa(undefined), null);
});

test("cada trava que a rota traduz existe de fato na migration", () => {
  // Achar a migration pelo nome, não pelo carimbo: o carimbo muda quando ela é
  // aplicada em produção e o arquivo é renomeado.
  const pasta = join(process.cwd(), "supabase", "migrations");
  const arquivo = readdirSync(pasta).find((nome) => nome.endsWith("_item_e_variante.sql"));
  assert.ok(arquivo, "migration de item e variante não encontrada");
  const sql = readFileSync(join(pasta, arquivo), "utf8");
  for (const trava of [
    "brand_assets_fonte_exige_termo", "brand_assets_eixos_do_logo", "brand_assets_eixos_do_icone",
    "brand_assets_eixos_fora_do_tipo", "brand_assets_espaco_de_cor_obrigatorio", "brand_assets_item_fkey",
    "brand_assets_substituto_do_mesmo_item", "brand_assets_lockup_check",
  ]) {
    assert.ok(sql.includes(trava), `a migration não tem mais a trava ${trava}`);
  }
});
