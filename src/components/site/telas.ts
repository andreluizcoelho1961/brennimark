import type { StaticImageData } from "next/image";
import manual from "./imagens/telas/manual.webp";
import manualBusca from "./imagens/telas/manual-busca.webp";
import manualIndice from "./imagens/telas/manual-indice.webp";
import assistente from "./imagens/telas/assistente.webp";
import revisao from "./imagens/telas/revisao.webp";
import prompt from "./imagens/telas/prompt.webp";
import materiais from "./imagens/telas/materiais.webp";
import itemLogotipo from "./imagens/telas/item-logotipo.webp";
import bancoDeImagens from "./imagens/telas/banco-de-imagens.webp";
import linksCriado from "./imagens/telas/links-criado.webp";
import receber from "./imagens/telas/receber.webp";
import complementos from "./imagens/telas/complementos.webp";
import complementoEditor from "./imagens/telas/complemento-editor.webp";
import viniComplemento from "./imagens/telas/vini-complemento.webp";
import pessoas from "./imagens/telas/pessoas.webp";
import registros from "./imagens/telas/registros.webp";
import manualEn from "./imagens/telas-en/manual.webp";
import manualBuscaEn from "./imagens/telas-en/manual-busca.webp";
import assistenteEn from "./imagens/telas-en/assistente.webp";
import revisaoEn from "./imagens/telas-en/revisao.webp";
import promptEn from "./imagens/telas-en/prompt.webp";
import materiaisEn from "./imagens/telas-en/materiais.webp";
import itemLogotipoEn from "./imagens/telas-en/item-logotipo.webp";
import bancoDeImagensEn from "./imagens/telas-en/banco-de-imagens.webp";
import linksCriadoEn from "./imagens/telas-en/links-criado.webp";
import receberEn from "./imagens/telas-en/receber.webp";
import complementosEn from "./imagens/telas-en/complementos.webp";
import complementoEditorEn from "./imagens/telas-en/complemento-editor.webp";
import viniComplementoEn from "./imagens/telas-en/vini-complemento.webp";
import pessoasEn from "./imagens/telas-en/pessoas.webp";
import registrosEn from "./imagens/telas-en/registros.webp";

/**
 * As capturas da plataforma que o site mostra, por idioma (29/10/2026).
 *
 * A plataforma tem interface em português e em inglês, e uma captura mostra a
 * interface inteira: com o site em inglês, a imagem em português seria texto que
 * o leitor não lê. As capturas em inglês saem da conta de demonstração (marca em
 * inglês), em 2880 × 1800, no mesmo quadro de 1440 × 900 das em português, então
 * os destaques e a câmera de `TelasDaHome` valem para as duas.
 *
 * O manual em inglês não traz sumário embutido, então não existe a captura do
 * índice: ali o slot mostra o manual aberto. Idioma desconhecido cai no português.
 */
export type Telas = {
  manual: StaticImageData;
  manualBusca: StaticImageData;
  /** O manual aberto, com o índice (só em português; em inglês é o manual aberto). */
  manualIndice: StaticImageData;
  assistente: StaticImageData;
  revisao: StaticImageData;
  prompt: StaticImageData;
  materiais: StaticImageData;
  itemLogotipo: StaticImageData;
  bancoDeImagens: StaticImageData;
  linksCriado: StaticImageData;
  receber: StaticImageData;
  complementos: StaticImageData;
  complementoEditor: StaticImageData;
  viniComplemento: StaticImageData;
  pessoas: StaticImageData;
  registros: StaticImageData;
};

const EM_PORTUGUES: Telas = {
  manual, manualBusca, manualIndice, assistente, revisao, prompt, materiais, itemLogotipo, bancoDeImagens,
  linksCriado, receber, complementos, complementoEditor, viniComplemento, pessoas, registros,
};

const EM_INGLES: Telas = {
  manual: manualEn,
  manualBusca: manualBuscaEn,
  manualIndice: manualEn,
  assistente: assistenteEn,
  revisao: revisaoEn,
  prompt: promptEn,
  materiais: materiaisEn,
  itemLogotipo: itemLogotipoEn,
  bancoDeImagens: bancoDeImagensEn,
  linksCriado: linksCriadoEn,
  receber: receberEn,
  complementos: complementosEn,
  complementoEditor: complementoEditorEn,
  viniComplemento: viniComplementoEn,
  pessoas: pessoasEn,
  registros: registrosEn,
};

export function telas(idioma: string): Telas {
  return idioma === "en" ? EM_INGLES : EM_PORTUGUES;
}
