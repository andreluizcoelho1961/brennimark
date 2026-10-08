import assert from "node:assert/strict";
import test from "node:test";
import { escaparHtml, mensagemDeAvisoDeExclusao, mensagemDeBoasVindas, mensagemDeCancelamento, mensagemDePedidoDeExportacao, mensagemDeRecuperacao } from "./mensagens";

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

test("o cancelamento: cada tipo diz o que acontece com o dinheiro e com a conta", () => {
  const entrar = "https://www.brennimark.com/login";
  const fim = mensagemDeCancelamento({ conta: "Agência <X>", tipo: "no-fim-do-periodo", ate: "2026-11-08T13:37:12Z", linkDeEntrar: entrar });
  assert.match(fim.texto, /até 8 de novembro de 2026/);
  assert.match(fim.texto, /não haverá nova cobrança/);
  assert.match(fim.texto, /Depois disso, a conta fica guardada só para leitura por 12 meses/);
  assert.ok(fim.html.includes("Agência &lt;X&gt;"));
  assert.ok(!fim.html.includes("Agência <X>"));

  const arrependeu = mensagemDeCancelamento({ conta: null, tipo: "arrependimento", ate: null, linkDeEntrar: entrar });
  assert.equal(arrependeu.assunto, "Assinatura cancelada e valor devolvido");
  assert.match(arrependeu.texto, /devolvemos o valor pago, por inteiro/);
  assert.match(arrependeu.texto, /O acesso completo terminou agora/);
  assert.doesNotMatch(arrependeu.texto, /continua até/);

  const cortada = mensagemDeCancelamento({ conta: null, tipo: "falta-de-pagamento", ate: null, linkDeEntrar: entrar });
  assert.match(cortada.texto, /pagamento não foi concluído/);
  assert.doesNotMatch(cortada.texto, /devolvemos/);

  for (const m of [fim, arrependeu, cortada]) assert.match(m.texto, /Entrar: https:\/\/www\.brennimark\.com\/login/);
});

test("o aviso de exclusão: a data, o que sai, o que fica e como guardar", () => {
  const m = mensagemDeAvisoDeExclusao({ conta: "Agência X", excluirEm: "2027-10-08T15:00:00Z", linkDeEntrar: "https://www.brennimark.com/login", contato: "contato@brennimark.com" });
  assert.equal(m.assunto, "Sua conta do Brennimark será excluída em 30 dias");
  assert.match(m.texto, /A conta Agência X foi cancelada há quase 12 meses/);
  assert.match(m.texto, /Em 8 de outubro de 2027/);
  assert.match(m.texto, /peça a exportação até lá/);
  assert.match(m.texto, /contato@brennimark\.com/);
  assert.match(m.texto, /Dados que a lei manda guardar/);
  assert.match(m.texto, /Entrar: https:\/\/www\.brennimark\.com\/login/);
});

test("o aviso de exportação à equipe: a conta, quem, quando e o prazo", () => {
  const m = mensagemDePedidoDeExportacao({ conta: "Agência <X>", pedidoPor: "dona@agencia.com", pedidoEm: "2026-10-08T15:00:00Z", prazo: "2026-10-23T15:00:00Z", linkDoConsole: "https://www.brennimark.com/console/cobranca" });
  assert.equal(m.assunto, "Pedido de exportação: Agência <X>");
  assert.match(m.texto, /pediu a exportação do conteúdo em 8 de outubro de 2026, por dona@agencia\.com/);
  assert.match(m.texto, /Prazo prometido nos Termos: 23 de outubro de 2026/);
  assert.ok(m.html.includes("Agência &lt;X&gt;"));
});
