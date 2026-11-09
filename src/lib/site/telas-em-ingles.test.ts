import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * As capturas em inglês do site (29/10/2026) precisam ter o MESMO quadro das em português:
 * 2880 × 1800. Os destaques e a câmera de `TelasDaHome` são escritos nesse quadro, e uma
 * captura de outro tamanho deslocaria todas as caixas sem avisar.
 */
function tamanhoDoWebp(arquivo: string): { w: number; h: number } {
  const b = fs.readFileSync(arquivo);
  assert.equal(b.toString("ascii", 0, 4), "RIFF");
  assert.equal(b.toString("ascii", 8, 12), "WEBP");
  const tipo = b.toString("ascii", 12, 16);
  if (tipo === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (tipo === "VP8L") { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
  if (tipo === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  throw new Error(`webp desconhecido: ${tipo}`);
}

const PASTA = path.join(process.cwd(), "src", "components", "site", "imagens");

test("toda captura em inglês tem 2880 × 1800, como as em português", () => {
  const ingles = fs.readdirSync(path.join(PASTA, "telas-en")).filter((f) => f.endsWith(".webp"));
  assert.ok(ingles.length >= 15, `esperava as capturas em inglês, achei ${ingles.length}`);
  for (const f of ingles) {
    assert.deepEqual(tamanhoDoWebp(path.join(PASTA, "telas-en", f)), { w: 2880, h: 1800 }, `telas-en/${f}`);
  }
});

test("toda captura em inglês tem a irmã em português (mesmo nome), e o mapa por idioma usa as duas pastas", () => {
  const ingles = fs.readdirSync(path.join(PASTA, "telas-en")).filter((f) => f.endsWith(".webp"));
  for (const f of ingles) assert.ok(fs.existsSync(path.join(PASTA, "telas", f)), `falta telas/${f}`);
  const mapa = fs.readFileSync(path.join(process.cwd(), "src", "components", "site", "telas.ts"), "utf8");
  for (const f of ingles) assert.ok(mapa.includes(`./imagens/telas-en/${f}`), `telas.ts não usa telas-en/${f}`);
});
