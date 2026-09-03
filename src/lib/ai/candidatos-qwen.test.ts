import assert from "node:assert/strict";
import test from "node:test";
import { CANDIDATOS_QWEN, candidatosDe } from "./candidatos-qwen";
import { modeloAutorizado } from "./catalogo";

test("nenhum candidato Qwen é aceito pela rota de configuração", () => {
  /*
   * A garantia que mais importa neste arquivo. `openrouter` já é um provedor
   * configurável hoje — para OUTROS modelos, catalogados antes deste
   * briefing — então comparar `caminho` com a lista de provedores testaria a
   * coisa errada. O que decide se um PAR provedor+modelo pode ser configurado
   * é `modeloAutorizado`, que só conhece `CATALOGO` — e os candidatos Qwen
   * vivem num arquivo SEPARADO, nunca fundido a ele. Se algum dia essa fusão
   * acontecer, é uma decisão explícita de P2, não um efeito colateral deste
   * módulo de comparação.
   */
  for (const candidato of CANDIDATOS_QWEN) {
    assert.equal(
      modeloAutorizado(candidato.caminho, candidato.model),
      false,
      `${candidato.caminho}/${candidato.model} já seria aceito pela configuração real`,
    );
  }
});

test("os dois caminhos de integração estão representados", () => {
  // O ponto da correção de direção: comparar, não escolher por conveniência
  // de código. Sem os dois lados, não há comparação nenhuma.
  assert.ok(candidatosDe("alibaba-direto").length > 0, "faltou o caminho direto");
  assert.ok(candidatosDe("openrouter").length > 0, "faltou o caminho via OpenRouter");
});

test("nenhum candidato tem preço de imagem verificado", () => {
  // Consistente com o catálogo principal: reservar orçamento de imagem sem
  // fonte oficial é inventar número.
  for (const c of CANDIDATOS_QWEN) {
    assert.equal(c.imagemNaoVerificada, true, `${c.model}: deveria marcar imagem não verificada`);
  }
});

test("todo preço citado tem data, região e fonte", () => {
  // "Dado auditável", não opinião: um preço sem os três é uma alegação, não
  // um fato que alguém possa conferir depois.
  for (const c of CANDIDATOS_QWEN) {
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.preco.coletadoEm), `${c.model}: data mal formada`);
    assert.ok(c.preco.regiao.length > 0, `${c.model}: sem região`);
    assert.ok(/^https?:\/\//.test(c.preco.fonte), `${c.model}: fonte não é URL`);
  }
});

test("nenhum candidato está marcado como padrão", () => {
  // A decisão fica para o benchmark (P2). Se algum dia um campo "default" ou
  // "recomendado" aparecer neste tipo, este teste é o lembrete de que a
  // correção de direção pediu explicitamente para NÃO fixar um agora.
  for (const c of CANDIDATOS_QWEN) {
    assert.ok(!("padrao" in c), `${c.model} foi marcado como padrão`);
    assert.ok(!("recomendado" in c), `${c.model} foi marcado como recomendado`);
  }
});

test("preço em dólares por milhão é positivo e plausível", () => {
  // Não valida o VALOR (isso é o benchmark) — valida que não há erro de
  // digitação grosseiro, como um preço negativo ou um zero por engano.
  for (const c of CANDIDATOS_QWEN) {
    assert.ok(c.preco.entradaPorMilhaoUsd > 0, `${c.model}: entrada não positiva`);
    assert.ok(c.preco.saidaPorMilhaoUsd > 0, `${c.model}: saída não positiva`);
    assert.ok(c.preco.entradaPorMilhaoUsd < 100, `${c.model}: entrada implausível`);
  }
});
