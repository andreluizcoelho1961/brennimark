import assert from "node:assert/strict";
import test from "node:test";
import {
  caminhoDeAsset,
  caminhoDeEvidencia,
  caminhoDeImportacao,
  nomeSeguro,
  pertenceAImportacao,
  pertenceAMarca,
} from "./caminhos";

const WS = "11111111-1111-1111-1111-111111111111";
const MARCA = "22222222-2222-2222-2222-222222222222";
const OUTRA = "33333333-3333-3333-3333-333333333333";

test("o caminho do asset começa por conta e marca, nesta ordem", () => {
  const caminho = caminhoDeAsset(WS, MARCA, "logo.svg", "abc");
  assert.equal(caminho, `${WS}/${MARCA}/abc-logo.svg`);
});

test("nenhum caminho contém chave, slug ou nome de marca", () => {
  // A regressão que isto impede: `workspaceId/padaria/...`. No dia em que a
  // marca é renomeada, os arquivos ficam num caminho que não corresponde mais
  // a nada — e nem a listagem nem a exclusão os encontram.
  const caminhos = [
    caminhoDeAsset(WS, MARCA, "logo.svg", "abc"),
    caminhoDeEvidencia(WS, MARCA, "run-1", "peca.png"),
  ];
  for (const caminho of caminhos) {
    const [conta, marca] = caminho.split("/");
    assert.match(conta, /^[0-9a-f-]{36}$/, "o primeiro segmento não é um id");
    assert.match(marca, /^[0-9a-f-]{36}$/, "o segundo segmento não é um id");
  }
});

test("o mesmo arquivo enviado duas vezes não colide", () => {
  assert.notEqual(
    caminhoDeAsset(WS, MARCA, "logo.svg", "um"),
    caminhoDeAsset(WS, MARCA, "logo.svg", "dois"),
  );
});

test("nome de arquivo hostil vira nome seguro, e não caminho", () => {
  // `../` no nome escaparia da pasta da marca e escreveria em outra.
  const caminho = caminhoDeAsset(WS, MARCA, "../../outro/segredo.png", "id");
  assert.equal(caminho.split("/").length, 3, "o nome do arquivo criou pastas");
  assert.ok(!caminho.includes(".."));
  assert.equal(nomeSeguro("a b/c..d"), "a-b-c.d");
});

test("nome que não sobra nada vira nome de reserva, não vazio", () => {
  // Caminho terminando em "-" seria aceito pelo Storage e impossível de achar.
  assert.equal(nomeSeguro("///"), "arquivo");
  assert.equal(nomeSeguro("..."), "arquivo");
  assert.equal(nomeSeguro(""), "arquivo");
});

test("o caminho da importação não leva a marca, porque ela ainda não existe", () => {
  // A importação acontece ANTES da marca. Um `brandId` aqui seria inventado.
  assert.equal(caminhoDeImportacao(WS, "imp-1", "h4sh"), `${WS}/imp-1/h4sh.pdf`);
});

test("o mesmo PDF importado duas vezes não vira um objeto compartilhado", () => {
  // Com o caminho sendo só conta+hash, duas marcas que importassem o MESMO
  // arquivo apontariam para o mesmo objeto. Apagar uma levaria o arquivo da
  // outra junto. O `importId` no meio é o que separa.
  assert.notEqual(
    caminhoDeImportacao(WS, "imp-1", "mesmohash"),
    caminhoDeImportacao(WS, "imp-2", "mesmohash"),
  );
});

test("o caminho de outra marca não é reconhecido como desta", () => {
  const daOutra = caminhoDeAsset(WS, OUTRA, "logo.svg", "abc");
  assert.equal(pertenceAMarca(daOutra, WS, MARCA), false);
  assert.equal(pertenceAMarca(daOutra, WS, OUTRA), true);
});

test("prefixo parecido não passa por igual", () => {
  // `<ws>/<marca>extra/...` começa com `<ws>/<marca>` como texto. Sem a barra
  // final na comparação, ele passaria — e assinaria arquivo de outra marca.
  assert.equal(pertenceAMarca(`${WS}/${MARCA}extra/x.png`, WS, MARCA), false);
});

test("caminho de outra CONTA não passa, mesmo com a marca certa", () => {
  assert.equal(pertenceAMarca(`${OUTRA}/${MARCA}/x.png`, WS, MARCA), false);
});

test("o PDF do manual pertence à importação e à conta lidas da linha — e a nada mais", () => {
  const importacao = "33333333-3333-3333-3333-333333333333";
  const hash = "a".repeat(64);
  const certo = caminhoDeImportacao(WS, importacao, hash);
  assert.equal(pertenceAImportacao(certo, WS, importacao), true);

  // Outra conta, outra importação, subpasta escondida, arquivo que não é o PDF.
  assert.equal(pertenceAImportacao(certo, "44444444-4444-4444-4444-444444444444", importacao), false);
  assert.equal(pertenceAImportacao(certo, WS, "55555555-5555-5555-5555-555555555555"), false);
  assert.equal(pertenceAImportacao(`${WS}/${importacao}/x/${hash}.pdf`, WS, importacao), false);
  assert.equal(pertenceAImportacao(`${WS}/${importacao}/pagina-1.png`, WS, importacao), false);
  assert.equal(pertenceAImportacao(`${WS}/${importacao}/../${hash}.pdf`, WS, importacao), false);
});
