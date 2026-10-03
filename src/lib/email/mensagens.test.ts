import assert from "node:assert/strict";
import test from "node:test";
import { escaparHtml, mensagemDeBoasVindas, mensagemDeRecuperacao } from "./mensagens";

test("a recuperação leva o link, o prazo e o que fazer se não foi você", () => {
  const m = mensagemDeRecuperacao({ link: "https://x.test/l?a=1&b=2", validoPorMinutos: 60 });
  assert.match(m.texto, /https:\/\/x\.test\/l\?a=1&b=2/);
  assert.match(m.texto, /60 minutos/);
  assert.match(m.texto, /Se não foi você/);
  assert.match(m.html, /href="https:\/\/x\.test\/l\?a=1&amp;b=2"/);
  assert.match(m.html, /Se não foi você/);
});

test("a confirmação da assinatura não leva link de acesso, só o caminho do Esqueci a senha", () => {
  const m = mensagemDeBoasVindas({ conta: "Agência <b>", linkDeEntrar: "https://x.test/login", linkDeSenha: "https://x.test/esqueci-senha" });
  assert.match(m.texto, /https:\/\/x\.test\/esqueci-senha/);
  assert.match(m.html, /Agência &lt;b&gt;/);
  assert.doesNotMatch(m.html, /<b>/);
});

test("escapar HTML", () => {
  assert.equal(escaparHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});
