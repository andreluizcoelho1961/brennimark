import assert from "node:assert/strict";
import test from "node:test";
import { caminhosNoKit, nomeDoKit, pastaDaVariante, segmentoSeguro } from "./kit";
import type { Eixos } from "./eixos";

const logo = (p: Partial<Eixos>): Eixos => ({
  hierarquia: "principal", lockup: "horizontal", cor: "colorido", polaridade: "positivo", espaco_de_cor: "rgb", ...p,
});
const semEixos: Eixos = { hierarquia: null, lockup: null, cor: null, polaridade: null, espaco_de_cor: null };

test("o ZIP se organiza pelos eixos, e o nome do arquivo é o que foi enviado", () => {
  const caminhos = caminhosNoKit("sony-vaio-logotipo.zip", [
    { id: "a", fileName: "VAIO_logo.svg", eixos: logo({}) },
    { id: "b", fileName: "VAIO_logo.eps", eixos: logo({ lockup: "vertical", cor: "monocromatico", polaridade: "negativo", espaco_de_cor: "cmyk" }) },
  ]);
  assert.equal(caminhos.get("a"), "sony-vaio-logotipo/principal/horizontal/colorido-positivo-rgb/vaio_logo.svg");
  assert.equal(caminhos.get("b"), "sony-vaio-logotipo/principal/vertical/monocromatico-negativo-cmyk/vaio_logo.eps");
});

test("eixo que não se aplica ao tipo não vira pasta", () => {
  assert.deepEqual(pastaDaVariante({ ...semEixos, espaco_de_cor: "rgb" }), ["rgb"]);
  assert.deepEqual(pastaDaVariante(semEixos), []);
});

test("dois arquivos com o mesmo nome na mesma pasta não se sobrescrevem", () => {
  const caminhos = caminhosNoKit("x.zip", [
    { id: "a", fileName: "logo.svg", eixos: logo({}) },
    { id: "b", fileName: "logo.svg", eixos: logo({}) },
    { id: "c", fileName: "logo.svg", eixos: logo({}) },
  ]);
  assert.deepEqual([...caminhos.values()], [
    "x/principal/horizontal/colorido-positivo-rgb/logo.svg",
    "x/principal/horizontal/colorido-positivo-rgb/logo-2.svg",
    "x/principal/horizontal/colorido-positivo-rgb/logo-3.svg",
  ]);
});

test("nome de arquivo do cliente não escapa da pasta", () => {
  assert.equal(segmentoSeguro("../../etc/passwd", "x"), "etcpasswd");
  assert.equal(segmentoSeguro("..", "reserva"), "reserva");
  assert.equal(segmentoSeguro("Logo Ação.svg", "x"), "logo-acao.svg");
  const [caminho] = caminhosNoKit("k.zip", [{ id: "a", fileName: "../fora.svg", eixos: semEixos }]).values();
  assert.equal(caminho, "k/fora.svg");
});

test("o nome do kit é marca-item.zip, sem acento nem espaço", () => {
  assert.equal(nomeDoKit("Sony Vaio", "Logotipo principal"), "sony-vaio-logotipo-principal.zip");
  assert.equal(nomeDoKit("", ""), "marca-materiais.zip");
});
