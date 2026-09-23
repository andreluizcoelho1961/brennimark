import assert from "node:assert/strict";
import test from "node:test";
import { nomeDoArquivoDoManual } from "./nome-do-arquivo";

test("o nome com que a agência enviou o manual é o nome do download", () => {
  assert.equal(nomeDoArquivoDoManual("VAIO_Brand_Guidelines.pdf", "Sony Vaio"), "VAIO_Brand_Guidelines.pdf");
  assert.equal(nomeDoArquivoDoManual("Manual da Marca.PDF", "X"), "Manual da Marca.pdf");
});

test("sem nome guardado, o nome da marca responde", () => {
  assert.equal(nomeDoArquivoDoManual(undefined, "Sony Vaio"), "Sony Vaio — manual.pdf");
  assert.equal(nomeDoArquivoDoManual("   ", "Sony Vaio"), "Sony Vaio — manual.pdf");
  assert.equal(nomeDoArquivoDoManual(42, ""), "Marca — manual.pdf");
});

test("caminho, caractere de controle e aspas não viram nome de arquivo", () => {
  assert.equal(nomeDoArquivoDoManual("C:\\manuais\\final.pdf", "X"), "final.pdf");
  assert.equal(nomeDoArquivoDoManual("../../etc/passwd", "X"), "passwd.pdf");
  assert.equal(nomeDoArquivoDoManual("a\u0000b\"c\r\n.pdf", "X"), "abc.pdf");
  assert.equal(nomeDoArquivoDoManual(".pdf", "Y"), "Y — manual.pdf");
});

test("nome gigante é aparado, e continua terminando em .pdf", () => {
  const nome = nomeDoArquivoDoManual(`${"a".repeat(500)}.pdf`, "X");
  assert.equal(nome.length, 124);
  assert.ok(nome.endsWith(".pdf"));
});
