import assert from "node:assert/strict";
import test from "node:test";

import {
  enviarArquivosDaImportacao, garantirAusencia,
  type ObjetoProvisorio, type PortasDeEnvio,
} from "./orfaos";

/**
 * O caso que dá nome a este arquivo: imagem enviada com sucesso, PDF falhando.
 *
 * Antes desta correção, o fluxo retornava aí mesmo, sem tocar nas imagens já
 * enviadas. Como a marca ainda não existia, nada no banco passava a apontar
 * para elas — nem `brand_assets`, nem `brand_imports`, nem `brand_deletions`.
 * O caminho existia só na memória daquela aba, e sumia com ela.
 *
 * O que estes testes exigem é o contrato inteiro: cada objeto provisório
 * termina FORA do Storage (confirmado por observação) ou DENTRO de uma fila
 * durável. Nunca em lugar nenhum.
 */

const BUCKET_IMG = "brand-assets";
const BUCKET_PDF = "brand-imports";

interface Registro {
  removidos: { bucket: string; caminhos: string[] }[];
  enfileirados: ObjetoProvisorio[][];
  enviados: string[];
}

function storageFalso(opcoes: {
  /** Caminhos que a remoção NÃO consegue apagar. */
  naoSaem?: string[];
  /** A observação de ausência lança. */
  observacaoQuebra?: boolean;
  /** O enfileiramento falha. */
  filaQuebra?: boolean;
  /** O envio do PDF falha com esta mensagem. */
  pdfFalhaCom?: string;
  /** O PDF já existe (409): reencontro, não erro. */
  pdfJaExiste?: boolean;
  /** Caminhos de imagem cujo envio falha. */
  imagensQueFalham?: string[];
}) {
  const noStorage = new Set<string>();
  const registro: Registro = { removidos: [], enfileirados: [], enviados: [] };
  const naoSaem = new Set(opcoes.naoSaem ?? []);

  const portas: PortasDeEnvio = {
    async enviarImagem(caminho) {
      if ((opcoes.imagensQueFalham ?? []).includes(caminho)) return { erro: "falhou" };
      noStorage.add(caminho);
      registro.enviados.push(caminho);
      return {};
    },
    async enviarPdf(caminho) {
      if (opcoes.pdfJaExiste) return { erro: "409", jaExiste: true };
      if (opcoes.pdfFalhaCom) return { erro: opcoes.pdfFalhaCom };
      noStorage.add(caminho);
      return {};
    },
    async remover(bucket, caminhos) {
      registro.removidos.push({ bucket, caminhos });
      for (const caminho of caminhos) {
        if (!naoSaem.has(caminho)) noStorage.delete(caminho);
      }
      return {};
    },
    async ausente(_bucket, caminho) {
      if (opcoes.observacaoQuebra) throw new Error("listagem indisponível");
      return !noStorage.has(caminho);
    },
    async enfileirar(itens) {
      if (opcoes.filaQuebra) return { erro: "fila indisponível" };
      registro.enfileirados.push(itens);
      return {};
    },
  };

  return { portas, registro, noStorage };
}

const PLANO = {
  imagens: [
    { caminho: "ws/brand/pagina-1.png", dados: "blob-1" },
    { caminho: "ws/brand/pagina-7.png", dados: "blob-7" },
  ],
  pdf: { caminho: "ws/import/hash.pdf", dados: "pdf" },
  bucketDeImagens: BUCKET_IMG,
  bucketDoPdf: BUCKET_PDF,
};

// ─── O cenário exigido: imagem sobe, PDF falha ─────────────────────────────

test("imagem enviada e PDF falhando: as imagens saem do Storage", async () => {
  const { portas, registro, noStorage } = storageFalso({ pdfFalhaCom: "500 no upload" });

  const r = await enviarArquivosDaImportacao(portas, PLANO);

  assert.equal(r.ok, false);
  assert.equal(registro.enviados.length, 2, "as duas imagens precisam ter subido de fato");
  // A prova: o Storage não tem mais nenhuma delas.
  assert.equal(noStorage.size, 0, "sobrou objeto no Storage");
  if (r.ok) return;
  assert.equal(r.limpeza.removidos.length, 2);
  assert.deepEqual(r.limpeza.enfileirados, []);
  assert.deepEqual(r.limpeza.perdidos, [], "nenhum caminho pode ficar sem destino");
});

test("imagem que o Storage recusa apagar vira pendência durável, não órfã", async () => {
  // O segundo desfecho aceitável do contrato: se o objeto não sai, o caminho
  // precisa sobreviver ao fechamento da aba — numa fila que a drenagem lê.
  const { portas, registro } = storageFalso({
    pdfFalhaCom: "500 no upload",
    naoSaem: ["ws/brand/pagina-7.png"],
  });

  const r = await enviarArquivosDaImportacao(portas, PLANO);

  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(r.limpeza.removidos.map((i) => i.caminho), ["ws/brand/pagina-1.png"]);
  assert.deepEqual(r.limpeza.enfileirados.map((i) => i.caminho), ["ws/brand/pagina-7.png"]);
  assert.deepEqual(r.limpeza.perdidos, []);
  // E a pendência foi mesmo registrada, com o bucket certo — sem ele a
  // drenagem procuraria o arquivo no bucket errado, observaria a ausência
  // (correta, no lugar errado) e fecharia a entrada.
  assert.deepEqual(registro.enfileirados, [[{ bucket: BUCKET_IMG, caminho: "ws/brand/pagina-7.png" }]]);
});

test("remoção e fila falhando: o caminho é declarado PERDIDO, nunca omitido", async () => {
  // O único desfecho ruim que sobra. Ele precisa ter nome para poder ser
  // registrado — um órfão silencioso é indistinguível de arquivo que nunca
  // existiu, e foi assim que o incidente P0 passou dois dias sem ser visto.
  const { portas } = storageFalso({
    pdfFalhaCom: "500 no upload",
    naoSaem: ["ws/brand/pagina-1.png", "ws/brand/pagina-7.png"],
    filaQuebra: true,
  });

  const r = await enviarArquivosDaImportacao(portas, PLANO);

  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(r.limpeza.removidos, []);
  assert.deepEqual(r.limpeza.enfileirados, []);
  assert.deepEqual(r.limpeza.perdidos.map((i) => i.caminho), [
    "ws/brand/pagina-1.png", "ws/brand/pagina-7.png",
  ]);
});

// ─── Os caminhos que NÃO podem virar limpeza ───────────────────────────────

test("PDF que já existe (409) é reencontro: nada é apagado", async () => {
  // Mesmo hash significa mesmo arquivo. Tratar 409 como falha apagaria as
  // imagens de uma importação que vai seguir normalmente.
  const { portas, registro, noStorage } = storageFalso({ pdfJaExiste: true });

  const r = await enviarArquivosDaImportacao(portas, PLANO);

  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.objetoNovo, false);
  assert.deepEqual(r.imagensEnviadas.length, 2);
  assert.deepEqual(registro.removidos, [], "não pode ter removido nada");
  assert.equal(noStorage.size, 2);
});

test("sucesso completo não aciona limpeza nenhuma", async () => {
  const { portas, registro } = storageFalso({});
  const r = await enviarArquivosDaImportacao(portas, PLANO);
  assert.equal(r.ok, true);
  assert.deepEqual(registro.removidos, []);
  assert.deepEqual(registro.enfileirados, []);
});

test("imagem que falhou ao enviar não entra na limpeza — não há o que limpar", async () => {
  // Limpar um caminho que nunca chegou ao Storage gastaria chamada e, pior,
  // enfileiraria uma pendência que a drenagem tentaria para sempre.
  const { portas, registro } = storageFalso({
    pdfFalhaCom: "500 no upload",
    imagensQueFalham: ["ws/brand/pagina-1.png"],
  });

  const r = await enviarArquivosDaImportacao(portas, PLANO);

  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(
    registro.removidos,
    [{ bucket: BUCKET_IMG, caminhos: ["ws/brand/pagina-7.png"] }],
  );
});

// ─── A observação é que decide, não a resposta da remoção ──────────────────

test("erro ao observar a ausência não é tratado como ausência", async () => {
  // `remove()` não é prova: a documentação do Storage não define o retorno
  // quando o objeto já não existe. Se a observação quebra, o lado seguro é
  // enfileirar — no pior caso a drenagem fecha a entrada de um arquivo que já
  // tinha saído, o que é barato. O contrário perde o arquivo de vista.
  const { portas, registro } = storageFalso({
    pdfFalhaCom: "500 no upload",
    observacaoQuebra: true,
  });

  const r = await enviarArquivosDaImportacao(portas, PLANO);

  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(r.limpeza.removidos, []);
  assert.equal(r.limpeza.enfileirados.length, 2);
  assert.equal(registro.enfileirados.length, 1);
});

test("lista vazia não chama Storage nem fila", async () => {
  // Guarda contra o teste que passa por vacuidade: sem esta asserção, uma
  // implementação que não fizesse NADA passaria em metade dos casos acima.
  const { portas, registro } = storageFalso({});
  const r = await garantirAusencia(portas, []);
  assert.deepEqual(r, { removidos: [], enfileirados: [], perdidos: [] });
  assert.deepEqual(registro.removidos, []);
  assert.deepEqual(registro.enfileirados, []);
});
