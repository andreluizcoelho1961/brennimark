import assert from "node:assert/strict";
import test from "node:test";
import { POLITICA_DE_PRIVACIDADE, TERMOS_DE_USO } from "./documentos-legais";

test("cada documento tem versão em data, seções numeradas em ordem e nenhuma seção vazia", () => {
  for (const doc of [TERMOS_DE_USO, POLITICA_DE_PRIVACIDADE]) {
    assert.match(doc.versao, /^\d{4}-\d{2}-\d{2}$/);
    doc.secoes.forEach((s, i) => {
      assert.ok(s.titulo.startsWith(`${i + 1}. `), s.titulo);
      assert.ok(s.paragrafos.length > 0, s.titulo);
    });
  }
});

test("os termos dizem as regras de cobrança que o produto aplica", () => {
  const texto = TERMOS_DE_USO.secoes.flatMap((s) => s.paragrafos).join(" ");
  // A regra do atraso (cobranca_vida): 7 dias com tudo, depois só leitura, nada apagado.
  assert.match(texto, /7 dias/);
  assert.match(texto, /só para leitura/);
  assert.match(texto, /Nada é apagado/);
  // Só cartão (02/10/2026).
  assert.match(texto, /cartão de crédito/);
  assert.doesNotMatch(texto, /\bPix\b/);
});

test("a privacidade não promete o que o produto não faz", () => {
  const texto = POLITICA_DE_PRIVACIDADE.secoes.flatMap((s) => s.paragrafos).join(" ");
  assert.match(texto, /Não guardamos o número do cartão/);
  // Conversas são do autor (migration conversas_por_autor).
  assert.match(texto, /Cada conversa é de quem a fez/);
  assert.doesNotMatch(texto, /cookies? de publicidade(?! nem)/);
});

test("os textos públicos identificam a empresa pelo CNPJ e pelo endereço do CNPJ, sem CPF", () => {
  const texto = [TERMOS_DE_USO, POLITICA_DE_PRIVACIDADE].flatMap((d) => d.secoes.flatMap((s) => s.paragrafos)).join(" ");
  assert.match(texto, /CNPJ 47\.924\.458\/0001-09/);
  // O nome empresarial do MEI traz o CPF do titular no fim; ele não vai a página pública.
  assert.doesNotMatch(texto, /\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)(?<!0001-\d{2})/);
  // O endereço é o do CNPJ, publicado por decisão do André (07/10/2026) —
  // exigência do Decreto 7.962/2013. O CPF continua fora.
  assert.match(texto, /Rua Vicente da Fontoura, 2547, apto\. 406, Petrópolis, Porto Alegre\/RS, CEP 90460-019/);
  assert.doesNotMatch(texto, /\[rua|CEP \[/);
});

test("reembolso: 7 dias de arrependimento e cobrança indevida devolvidos por inteiro", () => {
  const texto = TERMOS_DE_USO.secoes.flatMap((s) => s.paragrafos).join(" ");
  assert.match(texto, /em até 7 dias da primeira contratação recebe de volta o valor pago, por inteiro/);
  assert.match(texto, /cobrança em duplicidade, após o cancelamento ou causada por falha nossa é devolvida por inteiro/);
});

test("os textos dão um canal de contato de verdade, sem colchete de e-mail", () => {
  const texto = [TERMOS_DE_USO, POLITICA_DE_PRIVACIDADE].flatMap((d) => d.secoes.flatMap((s) => s.paragrafos)).join(" ");
  assert.doesNotMatch(texto, /\[e-mail/);
  assert.match(texto, /contato@brennimark\.com/);
});

test("revisão de 07/10: nenhum marcador de pendência no texto publicado; o link entre os documentos aponta para uma seção que existe", () => {
  const todos = [TERMOS_DE_USO, POLITICA_DE_PRIVACIDADE].flatMap((d) => d.secoes.flatMap((s) => s.paragrafos)).join(" ");
  assert.doesNotMatch(todos, /\[a confirmar/);
  const links = [...todos.matchAll(/\[\[termos#([a-z-]+)\|/g)].map((m) => m[1]);
  assert.ok(links.length > 0);
  for (const ancora of links) assert.ok(TERMOS_DE_USO.secoes.some((s) => s.id === ancora), ancora);
});

test("o Vini não promete chave própria do assinante: a IA é da plataforma (ADR-0008)", () => {
  const texto = POLITICA_DE_PRIVACIDADE.secoes.flatMap((s) => s.paragrafos).join(" ");
  assert.doesNotMatch(texto, /própria chave/);
});
